require("dotenv").config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

try {
    const ClientUserSettingManager = require("./node_modules/discord.js-selfbot-v13/src/managers/ClientUserSettingManager.js");
    if (ClientUserSettingManager && ClientUserSettingManager.prototype) {
        ClientUserSettingManager.prototype._patch = function () { return this; };
    }
} catch (e) {}

const { Client } = require("discord.js-selfbot-v13");
const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    StreamType,
    entersState,
    VoiceConnectionStatus
} = require("@discordjs/voice");
const { spawn } = require("child_process");
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const playdl = require('play-dl');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>RINTU</title><style>'
+ '*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}'
+ 'body{font-family:-apple-system,sans-serif;background:radial-gradient(ellipse at top,#1a0a2e 0%,#0a0414 60%,#000 100%);color:#e0e0e0;padding:18px 14px 60px;min-height:100vh}'
+ 'h1{font-size:26px;letter-spacing:3px;text-align:center;background:linear-gradient(90deg,#ff6ec7,#b57cff,#7c4dff);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;padding:10px 0}'
+ '.sub{text-align:center;font-size:11px;letter-spacing:3px;color:#8866aa;margin-bottom:16px}'
+ '.card{background:linear-gradient(180deg,#1a1230,#12091f);border:1px solid #2d1f4a;border-radius:14px;padding:14px;margin-bottom:12px}'
+ '.t{font-size:12px;letter-spacing:3px;color:#a688e0;margin-bottom:10px}'
+ 'textarea{width:100%;min-height:100px;background:#0a0514;color:#cbb8ff;border:1px solid #2d1f4a;border-radius:8px;padding:10px;font-family:monospace;font-size:12px}'
+ 'input{width:100%;background:#0a0514;color:#cbb8ff;border:1px solid #2d1f4a;border-radius:8px;padding:10px;font-size:13px}'
+ 'button{border:none;padding:10px 16px;border-radius:8px;font-weight:700;font-size:13px;letter-spacing:1px;margin:6px 6px 0 0;cursor:pointer}'
+ '.bs{background:linear-gradient(135deg,#ffb340,#ff8c00);color:#1a0a2e}'
+ '.bl{background:linear-gradient(135deg,#b57cff,#7c4dff);color:#fff}'
+ '.bst{background:linear-gradient(135deg,#00e676,#00a854);color:#fff;padding:10px 20px}'
+ '.bsp{background:linear-gradient(135deg,#ff5252,#d32f2f);color:#fff;padding:10px 20px}'
+ '.send{width:100%;background:linear-gradient(135deg,#b57cff,#7c4dff);color:#fff;margin-top:10px;padding:12px}'
+ '.p{display:inline-block;background:#1f1538;border:1px solid #2d1f4a;padding:5px 12px;border-radius:14px;font-size:12px;margin:6px 6px 0 0}'
+ '.p b{color:#ff6ec7}.p.ok b{color:#00e676}'
+ '.dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:6px}'
+ '.on{background:#00e676;box-shadow:0 0 8px #00e676}'
+ '.off{background:#ff5252;box-shadow:0 0 8px #ff5252}'
+ '.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}'
+ '.g{background:#1a1230;border:1px solid #2d1f4a;border-radius:8px;padding:10px 2px;text-align:center;cursor:pointer;font-size:11px;color:#a688e0}'
+ '.g:active{background:#2d1f4a}'
+ '#log{background:#0a0514;border:1px solid #2d1f4a;border-radius:8px;padding:10px;font-family:monospace;font-size:11px;max-height:220px;overflow-y:auto;color:#00e676;line-height:1.5;white-space:pre-wrap}'
+ '.err{color:#ff5252}.warn{color:#ffb340}.info{color:#b57cff}'
+ '</style></head><body>'
+ '<h1>RINTU DASHBOARD</h1><div class="sub">◆ self-bot controller ◆</div>'

+ '<div class="card"><div class="t">🔑 TOKENS</div>'
+ '<textarea id="tokens" placeholder="paste tokens, one per line"></textarea>'
+ '<div><span class="p">🎫 <b id="tc">0</b></span><span class="p ok">✅ <b id="tv">0</b></span></div>'
+ '<button class="bs" onclick="saveT()">save</button>'
+ '<button class="bl" onclick="loadT()">load</button></div>'

+ '<div class="card"><div>'
+ '<span class="dot off" id="dot"></span><span id="st">OFFLINE</span>'
+ '<span class="p">🤖 <b id="bc">0</b></span>'
+ '<span class="p">🔊 <b id="vd">100%</b></span>'
+ '</div><div style="margin-top:10px">'
+ '<button class="bst" onclick="start()">▶ START</button>'
+ '<button class="bsp" onclick="stop()">■ STOP</button>'
+ '</div></div>'

+ '<div class="card"><div class="t">⚡ QUICK</div><div class="grid">'
+ '<div class="g" onclick="cmd(\'stop\')">⏹️<br>stop</div>'
+ '<div class="g" onclick="cmd(\'pause\')">⏸️<br>pause</div>'
+ '<div class="g" onclick="cmd(\'resume\')">▶️<br>resume</div>'
+ '<div class="g" onclick="cmd(\'blast\')">🔥<br>blast</div>'
+ '<div class="g" onclick="cmd(\'doubleblast\')">💥<br>double</div>'
+ '<div class="g" onclick="cmd(\'superloud\')">🔊<br>super</div>'
+ '<div class="g" onclick="cmd(\'forceloud\')">⚡<br>force</div>'
+ '<div class="g" onclick="cmd(\'bassboost\')">🎵<br>bass</div>'
+ '<div class="g" onclick="cmd(\'pungi\')">🐍<br>pungi</div>'
+ '<div class="g" onclick="cmd(\'loudmode\')">📢<br>loud</div>'
+ '<div class="g" onclick="cmd(\'loop\')">🔄<br>loop</div>'
+ '<div class="g" onclick="cmd(\'leave\')">👋<br>leave</div>'
+ '<div class="g" onclick="cmd(\'max\')">💀<br>max</div>'
+ '<div class="g" onclick="cmd(\'status\')">📊<br>status</div>'
+ '</div></div>'

+ '<div class="card"><div class="t">⌨️ CMD</div>'
+ '<input id="ci" placeholder="play url or channel id" onkeydown="if(event.key===\'Enter\')send()">'
+ '<button class="send" onclick="send()">send ✦</button></div>'

+ '<div class="card"><div class="t">📜 LOG</div><div id="log"></div></div>'

+ '<script src="/socket.io/socket.io.js"></script><script>'
+ 'var s=io();function $(i){return document.getElementById(i)}'
+ 'function L(m,c){var e=$("log");var d=document.createElement("div");if(c)d.className=c;d.textContent="["+new Date().toLocaleTimeString()+"] "+m;e.appendChild(d);e.scrollTop=e.scrollHeight}'
+ '$("tokens").addEventListener("input",function(){var l=$("tokens").value.split("\\n").map(function(t){return t.trim()}).filter(function(t){return t.length>20});$("tc").textContent=l.length;$("tv").textContent=l.length});'
+ 'function saveT(){$("tokens").value;localStorage.setItem("rt",$("tokens").value);L("tokens saved","info")}'
+ 'function loadT(){var v=localStorage.getItem("rt")||"";$("tokens").value=v;var c=v.split("\\n").filter(function(t){return t.trim().length>20}).length;$("tc").textContent=c;$("tv").textContent=c;L("loaded "+c+" tokens","info")}'
+ 'window.addEventListener("DOMContentLoaded",loadT);'
+ 'function start(){var r=$("tokens").value.trim();if(!r)return L("no tokens","err");var l=r.split("\\n").map(function(t){return t.trim()}).filter(function(t){return t.length>20});if(!l.length)return L("no valid tokens","err");L("starting "+l.length,"info");s.emit("start_bots_with_tokens",{tokens:l})}'
+ 'function stop(){s.emit("stop_bots");L("stop sent","warn")}'
+ 'async function cmd(c){try{var r=await fetch("/api/command",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command:c})});var d=await r.json();L("> "+c+"\\n"+(d.response||d.error),d.error?"err":"")}catch(e){L("fail: "+e.message,"err")}}'
+ 'async function send(){var c=$("ci").value.trim();if(!c)return;await cmd(c);$("ci").value=""}'
+ 's.on("connect",function(){L("connected","info");$("dot").className="dot on";$("st").textContent="CONNECTED"});'
+ 's.on("disconnect",function(){L("disconnected","err");$("dot").className="dot off";$("st").textContent="OFFLINE"});'
+ 's.on("status_update",function(x){$("dot").className="dot "+(x.isRunning?"on":"off");$("st").textContent=x.isRunning?"ONLINE":"OFFLINE";$("bc").textContent=x.botCount||0;$("vd").textContent=(x.volume||100)+"%"});'
+ 's.on("bot_status",function(b){L("bot "+b.index+" "+b.status,"info")});'
+ 's.on("bots_started",function(d){L("started "+d.count,"info");$("dot").className="dot on";$("st").textContent="ONLINE";$("bc").textContent=d.count});'
+ 's.on("bots_stopped",function(){$("dot").className="dot off";$("st").textContent="OFFLINE";$("bc").textContent=0});'
+ 's.on("command_response",function(d){L("> "+d.command+"\\n"+d.response)});'
+ 's.on("audio_update",function(a){L("audio "+a.status+": "+a.title);$("vd").textContent=a.volume+"%"})'
+ '</script></body></html>';

app.get('/', (req, res) => res.type('html').send(HTML));
app.use(express.json());

let tokens = [];
let clients = [];
let connections = new Map();
let players = new Map();
let activeResources = new Map();
let currentFFmpegProcess = null;
let currentUrl = null;
let currentTitle = "Nothing playing";
let currentChannelId = null;
let loopMode = false;
let isPaused = false;
let isBassboosted = false;
let currentVolumeMultiplier = 1.0;
let blastMode = false;
let blastVolume = 50.0;
let pungiMode = false;
let pungiIntensity = 50.0;
let loudMode = false;
let loudModeBoost = 20.0;
let loudModeMaxVolume = 500.0;
let loudModeInterval = null;
let superLoudMode = false;
let forceLoudMode = false;
let isBotRunning = false;
let keepAliveInterval = null;

console.log("waiting for tokens from dashboard...");

function stopFFmpeg() {
    if (currentFFmpegProcess) {
        try { currentFFmpegProcess.kill("SIGKILL"); } catch (e) {}
        currentFFmpegProcess = null;
    }
}

function stopLoudMode() {
    if (loudModeInterval) { clearInterval(loudModeInterval); loudModeInterval = null; }
    loudMode = false;
}

function startLoudMode() {
    if (loudModeInterval) clearInterval(loudModeInterval);
    loudModeInterval = setInterval(() => {
        if (!loudMode || connections.size === 0) return;
        const primaryClient = clients[0];
        if (!primaryClient || !currentChannelId) return;
        const channel = primaryClient.channels.cache.get(currentChannelId);
        if (!channel) return;
        const clusterIds = clients.map(c => c.user?.id).filter(Boolean);
        const speaking = channel.members.filter(m => !clusterIds.includes(m.id) && !m.voice.selfMute && m.voice.speaking);
        const targetVolume = speaking.size > 0 ? Math.min(currentVolumeMultiplier * loudModeBoost, loudModeMaxVolume) : currentVolumeMultiplier;
        activeResources.forEach((r) => {
            if (r && r.volume && r.volume.volume !== targetVolume) r.volume.setVolume(targetVolume);
        });
    }, 400);
}

function isYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/.test(url);
}
function isDirectAudio(url) {
    return /\.(mp3|ogg|webm|m4a|wav|opus|aac)(\?.*)?$/i.test(url);
}

function buildFilters() {
    const f = ["highpass=f=60"];
    if (superLoudMode) {
        f.push("compand=attacks=0.01:decays=0.01:points=-80/-80|-30/-15|-12/-6|-6/-3|0/-2|20/-1");
        f.push("volume=15dB");
        f.push("acompressor=threshold=0.05:ratio=20:attack=5:release=50");
        f.push("alimiter=level_in=15:level_out=0:limit=0.99:attack=1:release=50");
        f.push("dynaudnorm=p=0.95:m=100:g=20");
    }
    if (forceLoudMode) {
        f.push("compand=attacks=0.001:decays=0.001:points=-80/-80|-40/-25|-20/-10|0/-5|10/-2|20/0|30/5");
        f.push("acompressor=threshold=0.01:ratio=50:attack=1:release=100");
        f.push("alimiter=level_in=25:level_out=0.99:limit=1:attack=1:release=100");
        f.push("dynaudnorm=p=1:m=100:g=30");
        f.push("volume=20dB");
        f.push("aecho=0.8:0.9:1000:0.3");
    }
    if (isBassboosted) f.push("equalizer=f=60:width_type=h:width=50:g=15");
    if (pungiMode) {
        f.push("acrusher=bits=4:mode=log:aa=1");
        f.push("equalizer=f=30:width_type=h:width=80:g=20");
        f.push("equalizer=f=1000:width_type=h:width=500:g=10");
        f.push(`volume=${pungiIntensity}`);
        f.push("aphaser=0.8:0.8:2000:0.4");
        f.push("aecho=0.8:0.9:1000:0.3");
    } else if (blastMode) {
        f.push(`volume=${blastVolume}`);
        f.push("dynaudnorm=p=0.9:m=50.0:g=15");
        f.push("alimiter=level_in=2.0:level_out=0.98:limit=0.99:attack=5:release=50");
    } else if (currentVolumeMultiplier > 1.0) {
        f.push(`volume=${currentVolumeMultiplier}`);
    }
    return f.join(",");
}

function startFFmpegStream(inputSource) {
    stopFFmpeg();
    const filters = buildFilters();
    currentFFmpegProcess = spawn(ffmpegPath, [
        "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_delay_max", "5",
        "-i", inputSource, "-filter:a", filters,
        "-f", "s16le", "-ar", "48000", "-ac", "2", "pipe:1"
    ]);
    currentFFmpegProcess.on('error', (e) => console.log('ffmpeg error:', e.message));
    clients.forEach((client, index) => {
        const player = players.get(index);
        if (player && currentFFmpegProcess) {
            const resource = createAudioResource(currentFFmpegProcess.stdout, { inputType: StreamType.Raw, inlineVolume: true });
            let effectiveVol = currentVolumeMultiplier;
            if (pungiMode) effectiveVol = Math.min(pungiIntensity, 200.0);
            else if (blastMode) effectiveVol = Math.min(blastVolume, 500.0);
            else if (superLoudMode) effectiveVol = Math.min(currentVolumeMultiplier * 20, 2000.0);
            else if (forceLoudMode) effectiveVol = Math.min(currentVolumeMultiplier * 30, 3000.0);
            else effectiveVol = Math.min(currentVolumeMultiplier * 2, 200.0);
            resource.volume.setVolume(effectiveVol);
            activeResources.set(index, resource);
            player.play(resource);
            io.emit('audio_update', { status: 'playing', title: currentTitle, volume: Math.round(effectiveVol * 100) });
        }
    });
    isPaused = false;
    if (loudMode) startLoudMode();
}

function startVoiceKeepAlive() {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(() => {
        connections.forEach((conn, index) => {
            if (!conn) return;
            const status = conn.state.status;
            if (status === VoiceConnectionStatus.Disconnected || status === VoiceConnectionStatus.Destroyed) {
                console.log(`bot ${index+1} voice dropped (${status})`);
            }
        });
    }, 30000);
}

function startBots() {
    if (tokens.length === 0) { console.log('no tokens'); return; }
    clients.length = 0;
    isBotRunning = true;
    tokens.forEach((token, index) => {
        const client = new Client({ checkUpdate: false });
        client.on("ready", () => {
            console.log(`bot ${index + 1}: ${client.user.tag}`);
            io.emit('bot_status', { index: index + 1, tag: client.user.tag, status: 'online' });
        });
        client.on("error", (e) => console.log(`bot ${index+1} error: ${e.message}`));
        client.login(token).catch((err) => {
            console.log(`bot ${index + 1} login failed: ${err.message}`);
            io.emit('bot_status', { index: index + 1, status: 'failed', tag: err.message });
        });
        clients.push(client);
    });
    io.emit('bots_started', { count: tokens.length });
    startVoiceKeepAlive();
}

function stopBots() {
    isBotRunning = false;
    stopFFmpeg();
    stopLoudMode();
    if (keepAliveInterval) { clearInterval(keepAliveInterval); keepAliveInterval = null; }
    players.forEach(p => { try { p.stop(); } catch(e){} });
    players.clear();
    connections.forEach(c => { try { c.destroy(); } catch(e){} });
    connections.clear();
    activeResources.clear();
    clients.forEach(c => { try { c.destroy(); } catch(e){} });
    clients.length = 0;
    currentUrl = null;
    currentChannelId = null;
    io.emit('bots_stopped');
    console.log("all bots stopped");
}

app.get('/api/status', (req, res) => {
    res.json({
        isRunning: isBotRunning, botCount: clients.length, currentTitle,
        volume: Math.round(currentVolumeMultiplier * 100),
        isPaused, loopMode, isBassboosted, blastMode, pungiMode, loudMode, superLoudMode, forceLoudMode,
        connected: connections.size > 0
    });
});

app.post('/api/command', async (req, res) => {
    const { command } = req.body;
    if (!command) return res.json({ error: 'no command' });
    const c = command.toLowerCase().trim();
    let response = '';
    try {
        if (c === 'help') response = 'cmds: play <url|yt|mp3>, volume <1-20000>, max, blast, doubleblast, superloud, forceloud, bassboost, pungi, pungiset <n>, loudmode, loop, pause, resume, stop, leave, status';
        else if (c.startsWith('play ')) {
            const url = command.slice(5).trim();
            if (connections.size === 0) response = 'join a vc first (send channel id)';
            else if (isDirectAudio(url)) { currentUrl = url; currentTitle = "Direct Audio"; startFFmpegStream(url); response = `playing direct: ${url}`; }
            else if (isYouTubeUrl(url)) {
                try {
                    const info = await playdl.video_info(url);
                    const stream = await playdl.stream(url, { quality: 2 });
                    currentUrl = stream.stream.url;
                    currentTitle = info.video_details.title || 'youtube';
                    startFFmpegStream(currentUrl);
                    response = `playing yt: ${currentTitle}`;
                } catch (e) { response = `yt error: ${e.message}`; }
            } else { currentUrl = url; currentTitle = "External Stream"; startFFmpegStream(url); response = `playing: ${url}`; }
        }
        else if (c === 'stop') { stopFFmpeg(); stopLoudMode(); players.forEach(p => p.stop()); activeResources.clear(); response = 'stopped'; }
        else if (c === 'pause') { players.forEach(p => p.pause()); isPaused = true; response = 'paused'; }
        else if (c === 'resume') { players.forEach(p => p.unpause()); isPaused = false; response = 'resumed'; }
        else if (c === 'leave') {
            stopFFmpeg(); stopLoudMode();
            players.forEach(p => p.stop()); players.clear();
            connections.forEach(x => { try { x.destroy(); } catch(e){} }); connections.clear();
            activeResources.clear(); currentUrl = null; currentChannelId = null; response = 'left all vcs';
        }
        else if (c.startsWith('volume ')) {
            const v = parseInt(command.slice(7).trim(), 10);
            if (isNaN(v) || v < 1 || v > 20000) response = 'volume 1-20000';
            else { currentVolumeMultiplier = v / 100; activeResources.forEach(r => r?.volume?.setVolume(currentVolumeMultiplier)); response = `volume ${v}%`; }
        }
        else if (c === 'max') { currentVolumeMultiplier = 100.0; activeResources.forEach(r => r?.volume?.setVolume(100.0)); if (currentUrl) startFFmpegStream(currentUrl); response = 'max volume 10000%'; }
        else if (c === 'blast') { blastMode = !blastMode; pungiMode = superLoudMode = forceLoudMode = false; if (currentUrl) startFFmpegStream(currentUrl); response = `blast ${blastMode?'on':'off'}`; }
        else if (c === 'doubleblast') { blastMode = true; blastVolume = 100.0; currentVolumeMultiplier = 100.0; if (currentUrl) startFFmpegStream(currentUrl); response = 'double blast'; }
        else if (c === 'superloud') { superLoudMode = !superLoudMode; if (superLoudMode) { blastMode = pungiMode = forceLoudMode = false; } if (currentUrl) startFFmpegStream(currentUrl); response = `superloud ${superLoudMode?'on':'off'}`; }
        else if (c === 'forceloud') { forceLoudMode = !forceLoudMode; if (forceLoudMode) { blastMode = pungiMode = superLoudMode = false; } if (currentUrl) startFFmpegStream(currentUrl); response = `forceloud ${forceLoudMode?'on':'off'}`; }
        else if (c === 'bassboost') { isBassboosted = !isBassboosted; if (currentUrl) startFFmpegStream(currentUrl); response = `bass ${isBassboosted?'on':'off'}`; }
        else if (c === 'pungi') { pungiMode = !pungiMode; if (pungiMode) { blastMode = superLoudMode = forceLoudMode = false; } if (currentUrl) startFFmpegStream(currentUrl); response = `pungi ${pungiMode?'on':'off'}`; }
        else if (c.startsWith('pungiset ')) { const v = parseFloat(command.slice(9)); if (!isNaN(v) && v>=1 && v<=200) { pungiIntensity = v; if (pungiMode && currentUrl) startFFmpegStream(currentUrl); response = `pungi ${v}x`; } else response = 'pungiset 1-200'; }
        else if (c === 'loudmode') { loudMode = !loudMode; if (loudMode) startLoudMode(); else stopLoudMode(); response = `loudmode ${loudMode?'on':'off'}`; }
        else if (c === 'loop') { loopMode = !loopMode; response = `loop ${loopMode?'on':'off'}`; }
        else if (c === 'status') response = `now: ${currentTitle}\nbots: ${clients.length}\nvol: ${Math.round(currentVolumeMultiplier*100)}%\nloop: ${loopMode?'on':'off'}`;
        else if (/^\d{15,25}$/.test(c)) {
            currentChannelId = c;
            let joined = 0;
            for (const [index, client] of clients.entries()) {
                try {
                    const channel = await client.channels.fetch(c);
                    if (!channel || !channel.guild) continue;
                    const conn = joinVoiceChannel({
                        channelId: channel.id, guildId: channel.guild.id,
                        adapterCreator: channel.guild.voiceAdapterCreator,
                        selfMute: false, selfDeaf: false, group: client.user.id
                    });
                    const player = createAudioPlayer();
                    conn.subscribe(player);
                    conn.on('stateChange', async (oldS, newS) => {
                        if (newS.status === VoiceConnectionStatus.Disconnected) {
                            try {
                                await Promise.race([
                                    entersState(conn, VoiceConnectionStatus.Signalling, 5000),
                                    entersState(conn, VoiceConnectionStatus.Connecting, 5000),
                                ]);
                            } catch {
                                try { conn.destroy(); } catch(e){}
                                setTimeout(() => {
                                    try {
                                        const nc = joinVoiceChannel({
                                            channelId: channel.id, guildId: channel.guild.id,
                                            adapterCreator: channel.guild.voiceAdapterCreator,
                                            selfMute: false, selfDeaf: false, group: client.user.id
                                        });
                                        nc.subscribe(players.get(index));
                                        connections.set(index, nc);
                                    } catch(e) { console.log('rejoin fail:', e.message); }
                                }, 3000);
                            }
                        }
                    });
                    player.on(AudioPlayerStatus.Idle, () => {
                        if (loopMode && currentUrl && !isPaused && index === 0) setTimeout(() => startFFmpegStream(currentUrl), 500);
                    });
                    connections.set(index, conn);
                    players.set(index, player);
                    joined++;
                } catch (err) { console.log(`bot ${index+1} join error: ${err.message}`); }
            }
            response = `joined ${joined}/${clients.length} bots to ${c}`;
        }
        else response = 'unknown cmd. type help';
    } catch (err) { response = `error: ${err.message}`; }
    io.emit('command_response', { command, response });
    res.json({ response });
});

io.on('connection', (socket) => {
    console.log('dashboard connected');
    socket.emit('status_update', {
        isRunning: isBotRunning, botCount: clients.length, totalTokens: tokens.length,
        currentTitle, volume: Math.round(currentVolumeMultiplier * 100)
    });
    socket.on('start_bots_with_tokens', (data) => {
        const incoming = (data?.tokens || []).map(t => (t || '').trim()).filter(t => t.length > 20);
        if (incoming.length === 0) {
            socket.emit('command_response', { command: 'start', response: 'no valid tokens' });
            return;
        }
        if (isBotRunning) stopBots();
        tokens = incoming;
        console.log(`tokens from dashboard: ${tokens.length}`);
        setTimeout(() => {
            startBots();
            socket.emit('command_response', { command: 'start', response: `starting ${tokens.length} bots` });
        }, 600);
    });
    socket.on('start_bots', () => startBots());
    socket.on('stop_bots', () => stopBots());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`dashboard on ${PORT}`));
