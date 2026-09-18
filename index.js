require("dotenv").config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client } = require("discord.js-selfbot-v13");
const { joinVoiceChannel, VoiceConnectionStatus, entersState } = require("@discordjs/voice");

try {
    const ClientUserSettingManager = require("./node_modules/discord.js-selfbot-v13/src/managers/ClientUserSettingManager.js");
    if (ClientUserSettingManager && ClientUserSettingManager.prototype) {
        ClientUserSettingManager.prototype._patch = function () { return this; };
    }
} catch (e) {}

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const HTML = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>RINTU VC</title><style>'
+ '*{box-sizing:border-box;margin:0;padding:0}'
+ 'body{font-family:-apple-system,sans-serif;background:radial-gradient(ellipse at top,#1a0a2e,#0a0414 60%,#000);color:#e0e0e0;padding:18px 14px;min-height:100vh}'
+ 'h1{font-size:24px;text-align:center;background:linear-gradient(90deg,#ff6ec7,#b57cff,#7c4dff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;padding:10px 0}'
+ '.sub{text-align:center;font-size:11px;color:#8866aa;margin-bottom:16px;letter-spacing:2px}'
+ '.c{background:linear-gradient(180deg,#1a1230,#12091f);border:1px solid #2d1f4a;border-radius:14px;padding:14px;margin-bottom:12px}'
+ '.t{font-size:12px;color:#a688e0;margin-bottom:8px;letter-spacing:2px}'
+ 'textarea{width:100%;min-height:100px;background:#0a0514;color:#cbb8ff;border:1px solid #2d1f4a;border-radius:8px;padding:10px;font-family:monospace;font-size:12px}'
+ 'input{width:100%;background:#0a0514;color:#cbb8ff;border:1px solid #2d1f4a;border-radius:8px;padding:10px}'
+ 'button{border:none;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px;margin:6px 6px 0 0;color:#fff;cursor:pointer}'
+ '.s{background:linear-gradient(135deg,#00e676,#00a854)}'
+ '.x{background:linear-gradient(135deg,#ff5252,#d32f2f)}'
+ '.j{width:100%;background:linear-gradient(135deg,#b57cff,#7c4dff);margin-top:8px;padding:12px}'
+ '.p{display:inline-block;background:#1f1538;border:1px solid #2d1f4a;padding:5px 12px;border-radius:14px;font-size:12px;margin:6px 6px 0 0}'
+ '.p b{color:#00e676}'
+ '#log{background:#0a0514;border:1px solid #2d1f4a;border-radius:8px;padding:10px;font-family:monospace;font-size:11px;max-height:300px;overflow-y:auto;color:#00e676;white-space:pre-wrap;line-height:1.5}'
+ '.e{color:#ff5252}.w{color:#ffb340}.i{color:#b57cff}'
+ '</style></head><body>'
+ '<h1>RINTU VC 24/7</h1><div class="sub">stay in voice forever</div>'
+ '<div class="c"><div class="t">TOKENS</div>'
+ '<textarea id="tokens" placeholder="one token per line"></textarea>'
+ '<div><span class="p">count: <b id="tc">0</b></span></div>'
+ '<button class="s" onclick="start()">START BOTS</button>'
+ '<button class="x" onclick="stop()">STOP</button></div>'
+ '<div class="c"><div class="t">VOICE CHANNEL</div>'
+ '<input id="vc" placeholder="voice channel id">'
+ '<button class="j" onclick="join()">JOIN VC</button>'
+ '<div style="margin-top:10px"><span class="p">in vc: <b id="incount">0</b></span></div></div>'
+ '<div class="c"><div class="t">LOG</div><div id="log"></div></div>'
+ '<script src="/socket.io/socket.io.js"></script><script>'
+ 'var s=io(),$=function(i){return document.getElementById(i)};'
+ 'function L(m,c){var e=$("log"),d=document.createElement("div");if(c)d.className=c;d.textContent="["+new Date().toLocaleTimeString()+"] "+m;e.appendChild(d);e.scrollTop=e.scrollHeight}'
+ '$("tokens").addEventListener("input",function(){var l=$("tokens").value.split("\\n").filter(function(t){return t.trim().length>20});$("tc").textContent=l.length});'
+ 'function start(){var l=$("tokens").value.split("\\n").map(function(t){return t.trim()}).filter(function(t){return t.length>20});if(!l.length)return L("no tokens","e");L("starting "+l.length,"i");s.emit("start",{tokens:l})}'
+ 'function stop(){s.emit("stop");L("stop sent","w")}'
+ 'function join(){var c=$("vc").value.trim();if(!c)return L("need channel id","e");s.emit("join",{channel:c});L("join "+c,"i")}'
+ 's.on("log",function(m){L(m.msg,m.cls||"")});'
+ 's.on("incount",function(n){$("incount").textContent=n});'
+ '</script></body></html>';

app.get('/', (req, res) => res.type('html').send(HTML));

let tokens = [];
let clients = [];
let connections = new Map();
let currentChannelId = null;
let watchdog = null;
let rejoinTimer = null;
let isRunning = false;

console.log("waiting for tokens...");

function emit(msg, cls) {
    console.log(msg);
    io.emit('log', { msg, cls });
}

async function joinOne(index, client) {
    if (!currentChannelId) return false;
    try {
        const channel = await client.channels.fetch(currentChannelId);
        if (!channel || !channel.guild) {
            emit(`bot ${index+1}: channel not found`, 'e');
            return false;
        }
        const existing = connections.get(index);
        if (existing) {
            try { existing.destroy(); } catch(e){}
            connections.delete(index);
        }
        const conn = joinVoiceChannel({
            channelId: channel.id,
            guildId: channel.guild.id,
            adapterCreator: channel.guild.voiceAdapterCreator,
            selfMute: true,
            selfDeaf: true,
            group: client.user.id
        });
        connections.set(index, conn);

        conn.on('stateChange', async (oldS, newS) => {
            if (oldS.status !== newS.status) emit(`bot ${index+1}: ${oldS.status}->${newS.status}`);
            if (newS.status === VoiceConnectionStatus.Disconnected) {
                try {
                    await Promise.race([
                        entersState(conn, VoiceConnectionStatus.Signalling, 5000),
                        entersState(conn, VoiceConnectionStatus.Connecting, 5000)
                    ]);
                } catch {
                    try { conn.destroy(); } catch(e){}
                    connections.delete(index);
                }
            }
        });

        emit(`bot ${index+1} joined vc`, 'i');
        return true;
    } catch (e) {
        emit(`bot ${index+1} join err: ${e.message}`, 'e');
        return false;
    }
}

function startWatchdog() {
    if (watchdog) clearInterval(watchdog);
    watchdog = setInterval(async () => {
        if (!isRunning || !currentChannelId) return;
        let inVc = 0;
        for (const [i, client] of clients.entries()) {
            const conn = connections.get(i);
            const st = conn?.state?.status;
            if (st === VoiceConnectionStatus.Ready) inVc++;
            else await joinOne(i, client);
        }
        io.emit('incount', inVc);
    }, 20000);
}

// force reconnect every 90 minutes to avoid discord's ~4h voice token expiry
function startRejoinTimer() {
    if (rejoinTimer) clearInterval(rejoinTimer);
    rejoinTimer = setInterval(async () => {
        if (!isRunning || !currentChannelId || clients.length === 0) return;
        emit('scheduled rejoin (90min refresh)', 'w');
        for (const [i, client] of clients.entries()) {
            try {
                const conn = connections.get(i);
                if (conn) { try { conn.destroy(); } catch(e){} connections.delete(i); }
                await new Promise(r => setTimeout(r, 300));
                await joinOne(i, client);
            } catch (e) { emit(`rejoin ${i+1} err: ${e.message}`, 'e'); }
        }
    }, 90 * 60 * 1000);
}

// also re-login the gateway every 3 hours to refresh session
function startSessionRefresh() {
    if (global._sessRef) clearInterval(global._sessRef);
    global._sessRef = setInterval(async () => {
        if (!isRunning) return;
        emit('gateway session refresh (3h)', 'w');
        for (const [i, client] of clients.entries()) {
            try {
                const conn = connections.get(i);
                if (conn) { try { conn.destroy(); } catch(e){} connections.delete(i); }
            } catch(e){}
        }
        await new Promise(r => setTimeout(r, 1500));
        if (currentChannelId) {
            for (const [i, client] of clients.entries()) {
                await joinOne(i, client);
                await new Promise(r => setTimeout(r, 500));
            }
        }
    }, 3 * 60 * 60 * 1000);
}

function startBots(newTokens) {
    if (isRunning) stopBots();
    tokens = newTokens;
    clients = [];
    isRunning = true;
    tokens.forEach((token, i) => {
        const client = new Client({ checkUpdate: false });
        client.on('ready', () => {
            emit(`bot ${i+1} online: ${client.user.tag}`, 'i');
            try { client.user.setStatus('online'); } catch(e){}
            if (currentChannelId) joinOne(i, client);
        });
        client.on('error', (e) => emit(`bot ${i+1} err: ${e.message}`, 'e'));
        client.on('disconnect', () => emit(`bot ${i+1} gateway disconnect`, 'w'));
        client.on('reconnecting', () => emit(`bot ${i+1} reconnecting...`, 'w'));
        client.login(token).catch(err => emit(`bot ${i+1} login fail: ${err.message}`, 'e'));
        clients.push(client);
    });
    startWatchdog();
    startRejoinTimer();
    startSessionRefresh();
}

function stopBots() {
    isRunning = false;
    if (watchdog) { clearInterval(watchdog); watchdog = null; }
    if (rejoinTimer) { clearInterval(rejoinTimer); rejoinTimer = null; }
    if (global._sessRef) { clearInterval(global._sessRef); global._sessRef = null; }
    connections.forEach(c => { try { c.destroy(); } catch(e){} });
    connections.clear();
    clients.forEach(c => { try { c.destroy(); } catch(e){} });
    clients = [];
    currentChannelId = null;
    emit('stopped all', 'w');
    io.emit('incount', 0);
}

io.on('connection', (socket) => {
    emit('dashboard connected', 'i');
    socket.on('start', (d) => {
        const t = (d.tokens || []).map(x => (x||'').trim()).filter(x => x.length > 20);
        if (!t.length) return emit('no valid tokens', 'e');
        startBots(t);
    });
    socket.on('stop', () => stopBots());
    socket.on('join', async (d) => {
        currentChannelId = (d.channel||'').trim();
        if (!/^\d{15,25}$/.test(currentChannelId)) return emit('bad channel id', 'e');
        emit('joining ' + currentChannelId + ' with ' + clients.length + ' bots', 'i');
        for (const [i, client] of clients.entries()) {
            await joinOne(i, client);
            await new Promise(r => setTimeout(r, 800));
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => console.log('dashboard on ' + PORT));
