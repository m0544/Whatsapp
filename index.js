const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const { getLinkPreview } = require('link-preview-js');
const express = require('express');

// יצירת תיקיית מדיה
const mediaDir = 'media';
if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir);
}

// מערכים לשמירת הודעות, סטטוסים ומשימות
let messages = [];
let statuses = [];
let todos = [];

// טעינת משימות מקובץ אם קיים
const todosFile = 'todos.json';
if (fs.existsSync(todosFile)) {
    try {
        todos = JSON.parse(fs.readFileSync(todosFile, 'utf8'));
    } catch (e) {
        todos = [];
    }
}

// שמירת משימות לקובץ
function saveTodos() {
    fs.writeFileSync(todosFile, JSON.stringify(todos, null, 2));
}

// הגדרת Express server
const app = express();
const PORT = 3000;
app.use(express.json());
app.use('/media', express.static('media'));

// פונקציות עזר
function linkify(text) {
    if (!text) return '';
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
    return text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
}

function extractUrls(text) {
    if (!text) return [];
    const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;
    return text.match(urlRegex) || [];
}

async function fetchLinkPreview(url) {
    try {
        const preview = await getLinkPreview(url, {
            timeout: 5000,
            followRedirects: 'follow',
            headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        return preview;
    } catch (error) {
        return null;
    }
}

// דף HTML ראשי
const htmlPage = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <title>הודעות וואטסאפ</title>
    <style>
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #0a1628; color: #e4e6eb; margin: 0; direction: rtl; }
        
        .layout { display: flex; min-height: 100vh; }
        
        /* Main content */
        .main-content { flex: 1; padding: 20px; overflow-y: auto; }
        .container { max-width: 800px; margin: 0 auto; }
        h1 { color: #25D366; text-align: center; margin-bottom: 10px; }
        .status-bar { text-align: center; color: #8b9dc3; margin-bottom: 20px; font-size: 0.9em; }
        .status-bar .online { color: #25D366; }
        
        /* Tabs */
        .tabs { display: flex; gap: 10px; margin-bottom: 20px; justify-content: center; }
        .tab { padding: 12px 25px; border-radius: 25px; cursor: pointer; font-size: 1em; border: 2px solid #2d4a6f; background: transparent; color: #8b9dc3; transition: all 0.3s; }
        .tab:hover { border-color: #25D366; color: #25D366; }
        .tab.active { background: #25D366; color: white; border-color: #25D366; }
        .tab.status-tab.active { background: #00a884; border-color: #00a884; }
        .tab .badge { background: #dc3545; color: white; border-radius: 50%; padding: 2px 8px; font-size: 0.75em; margin-right: 8px; }
        
        /* Sidebar TODO */
        .sidebar { width: 350px; background: #0d1b2a; border-right: 1px solid #1e3a5f; padding: 20px; overflow-y: auto; position: sticky; top: 0; height: 100vh; }
        .sidebar h2 { color: #f0ad4e; margin: 0 0 20px 0; display: flex; align-items: center; gap: 10px; font-size: 1.3em; }
        .todo-stats { display: flex; gap: 15px; margin-bottom: 20px; font-size: 0.85em; }
        .todo-stat { background: #1e3a5f; padding: 8px 12px; border-radius: 8px; }
        .todo-stat.pending { border-left: 3px solid #f0ad4e; }
        .todo-stat.done { border-left: 3px solid #25D366; }
        
        .todo-list { }
        .todo-item { background: #1e3a5f; border-radius: 10px; padding: 12px; margin-bottom: 10px; border-right: 4px solid #f0ad4e; transition: all 0.2s; }
        .todo-item.completed { border-right-color: #25D366; opacity: 0.7; }
        .todo-item.completed .todo-content { text-decoration: line-through; color: #8b9dc3; }
        .todo-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .todo-sender { color: #25D366; font-weight: bold; font-size: 0.9em; }
        .todo-chat { color: #8b9dc3; font-size: 0.75em; }
        .todo-content { color: #e4e6eb; font-size: 0.95em; line-height: 1.4; margin: 8px 0; word-break: break-word; }
        .todo-time { color: #65676b; font-size: 0.75em; }
        .todo-actions { display: flex; gap: 8px; margin-top: 10px; }
        .todo-btn { border: none; padding: 6px 12px; border-radius: 15px; cursor: pointer; font-size: 0.8em; transition: all 0.2s; }
        .todo-btn.complete { background: #25D366; color: white; }
        .todo-btn.complete:hover { background: #1da851; }
        .todo-btn.delete { background: #dc3545; color: white; }
        .todo-btn.delete:hover { background: #c82333; }
        .todo-btn.undo { background: #6c757d; color: white; }
        
        .no-todos { text-align: center; color: #8b9dc3; padding: 30px; font-size: 0.9em; }
        
        /* Messages */
        .message { background: #1e3a5f; border-radius: 12px; padding: 15px; margin: 10px 0; border-right: 4px solid #25D366; position: relative; }
        .message.sent { background: #0d4a3e; border-right-color: #128C7E; margin-right: 50px; }
        .message.sent .sender { color: #128C7E; }
        .message.status-msg { border-right-color: #00a884; background: #0d2a3a; }
        
        .delete-msg-btn { position: absolute; top: 10px; left: 10px; background: transparent; border: none; color: #dc3545; cursor: pointer; font-size: 1.2em; opacity: 0.5; transition: opacity 0.2s; }
        .delete-msg-btn:hover { opacity: 1; }
        
        .sender { color: #25D366; font-weight: bold; font-size: 1.1em; }
        .chat { color: #8b9dc3; font-size: 0.9em; }
        .content { margin: 10px 0; font-size: 1.1em; line-height: 1.6; white-space: pre-wrap; word-break: break-word; }
        .content a { color: #58a6ff; text-decoration: none; }
        .time { color: #65676b; font-size: 0.8em; }
        
        .quoted-message { background: #0d2137; border-radius: 8px; padding: 10px; margin-bottom: 10px; border-right: 3px solid #8b9dc3; }
        .quoted-sender { color: #8b9dc3; font-size: 0.85em; font-weight: bold; }
        .quoted-content { color: #a0a0a0; font-size: 0.9em; margin-top: 5px; }
        
        .replies { margin-top: 10px; margin-right: 20px; border-right: 2px solid #2d4a6f; padding-right: 15px; }
        .reply-message { background: #0d4a3e; border-radius: 10px; padding: 12px; margin: 8px 0; border-right: 3px solid #128C7E; }
        .reply-message .sender { color: #128C7E; font-size: 1em; }
        
        .media-container { margin: 10px 0; }
        .media-container img { max-width: 350px; max-height: 350px; border-radius: 8px; cursor: pointer; display: block; }
        .media-container video { max-width: 400px; max-height: 350px; border-radius: 8px; display: block; }
        .sticker { max-width: 150px !important; max-height: 150px !important; }
        
        .link-preview { background: #0d2137; border-radius: 8px; margin: 10px 0; overflow: hidden; border: 1px solid #2d4a6f; max-width: 400px; }
        .link-preview a { text-decoration: none; color: inherit; display: block; }
        .link-preview:hover { border-color: #25D366; }
        .link-preview-image { width: 100%; max-height: 180px; object-fit: cover; }
        .link-preview-content { padding: 10px; }
        .link-preview-title { color: #e4e6eb; font-weight: bold; font-size: 0.95em; margin-bottom: 5px; }
        .link-preview-url { color: #65676b; font-size: 0.75em; }
        
        .action-buttons { display: flex; gap: 8px; margin-top: 10px; padding-top: 10px; border-top: 1px solid #2d4a6f; flex-wrap: wrap; }
        .action-btn { border: none; padding: 8px 14px; border-radius: 20px; cursor: pointer; font-size: 0.85em; transition: all 0.2s; }
        .reply-btn { background: #25D366; color: white; }
        .reply-btn:hover { background: #1da851; }
        .todo-add-btn { background: #f0ad4e; color: #000; }
        .todo-add-btn:hover { background: #ec971f; }
        .todo-add-btn.added { background: #6c757d; color: white; cursor: default; }
        
        .reply-form { display: none; margin-top: 10px; }
        .reply-form.active { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .reply-input { flex: 1; min-width: 200px; padding: 10px 15px; border-radius: 20px; border: 1px solid #2d4a6f; background: #0d2137; color: #e4e6eb; font-size: 1em; direction: rtl; }
        .reply-input:focus { outline: none; border-color: #25D366; }
        .send-btn { background: #25D366; color: white; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; }
        .cancel-btn { background: #dc3545; color: white; border: none; padding: 10px 15px; border-radius: 20px; cursor: pointer; }
        .status { font-size: 0.85em; margin-top: 8px; width: 100%; }
        .status.success { color: #25D366; }
        .status.error { color: #dc3545; }
        .no-messages { text-align: center; color: #8b9dc3; padding: 50px; }
        
        #statuses-container { display: none; }
        
        @media (max-width: 900px) {
            .layout { flex-direction: column-reverse; }
            .sidebar { width: 100%; height: auto; position: relative; border-right: none; border-top: 1px solid #1e3a5f; }
        }
    </style>
</head>
<body>
    <div class="layout">
        <aside class="sidebar">
            <h2>📋 רשימת משימות</h2>
            <div class="todo-stats">
                <div class="todo-stat pending"><span id="pending-count">0</span> ממתינות</div>
                <div class="todo-stat done"><span id="done-count">0</span> הושלמו</div>
            </div>
            <div id="todo-list" class="todo-list">
                <div class="no-todos">אין משימות עדיין<br>לחץ על ⭐ ליד הודעה להוספה</div>
            </div>
        </aside>
        
        <main class="main-content">
            <div class="container">
                <h1>📱 הודעות וואטסאפ</h1>
                <div class="status-bar">
                    <span class="online">● מחובר</span> | הודעות מתעדכנות אוטומטית
                </div>
                
                <div class="tabs">
                    <button class="tab active" onclick="switchTab('messages')">💬 הודעות <span class="badge" id="msg-count">0</span></button>
                    <button class="tab status-tab" onclick="switchTab('statuses')">🔄 סטטוסים <span class="badge" id="status-count">0</span></button>
                </div>
                
                <div id="messages-container">
                    <div id="messages">
                        <div class="no-messages">ממתין להודעות...</div>
                    </div>
                </div>
                
                <div id="statuses-container">
                    <div id="statuses">
                        <div class="no-messages">ממתין לסטטוסים...</div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <script>
        let lastUpdate = 0;
        let lastStatusUpdate = 0;
        let lastTodoUpdate = 0;
        let currentTodos = [];
        let currentTab = 'messages';
        
        function switchTab(tab) {
            currentTab = tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelector('.tab' + (tab === 'statuses' ? '.status-tab' : ':not(.status-tab)')).classList.add('active');
            document.getElementById('messages-container').style.display = tab === 'messages' ? 'block' : 'none';
            document.getElementById('statuses-container').style.display = tab === 'statuses' ? 'block' : 'none';
        }
        
        function isInTodos(msgIndex) {
            return currentTodos.some(t => t.msgIndex === msgIndex);
        }
        
        function toggleReply(msgId) {
            const form = document.getElementById('reply-' + msgId);
            const wasActive = form.classList.contains('active');
            document.querySelectorAll('.reply-form').forEach(f => f.classList.remove('active'));
            if (!wasActive) {
                form.classList.add('active');
                document.getElementById('input-' + msgId).focus();
            }
        }

        async function sendReply(msgId, chatId, originalContent) {
            const input = document.getElementById('input-' + msgId);
            const status = document.getElementById('status-' + msgId);
            const message = input.value.trim();
            
            if (!message) {
                status.textContent = '❌ אנא הכנס הודעה';
                status.className = 'status error';
                return;
            }
            
            status.textContent = '⏳ שולח...';
            
            try {
                const response = await fetch('/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chatId, message, msgIndex: parseInt(msgId.replace('msg-', '')) })
                });
                const result = await response.json();
                if (result.success) {
                    status.textContent = '✅ נשלח!';
                    status.className = 'status success';
                    input.value = '';
                    setTimeout(() => { toggleReply(msgId); status.textContent = ''; loadMessages(); }, 500);
                } else {
                    status.textContent = '❌ ' + (result.error || 'שגיאה');
                    status.className = 'status error';
                }
            } catch (error) {
                status.textContent = '❌ שגיאת רשת';
                status.className = 'status error';
            }
        }

        async function deleteMessage(index, isStatus) {
            if (!confirm('למחוק את ההודעה?')) return;
            try {
                await fetch('/messages/' + index + '?isStatus=' + isStatus, { method: 'DELETE' });
                lastUpdate = 0;
                lastStatusUpdate = 0;
                loadMessages();
                loadStatuses();
            } catch (error) {}
        }

        async function addToTodo(msgIndex, sender, chat, content, time) {
            const btn = event.target;
            btn.disabled = true;
            btn.textContent = '⏳';
            
            try {
                const response = await fetch('/todos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ msgIndex, sender, chat, content, time })
                });
                const result = await response.json();
                if (result.success) {
                    btn.textContent = '✓ נוסף';
                    btn.classList.add('added');
                    loadTodos();
                } else {
                    btn.textContent = '⭐ משימה';
                    btn.disabled = false;
                }
            } catch (error) {
                btn.textContent = '⭐ משימה';
                btn.disabled = false;
            }
        }

        async function toggleTodo(todoId) {
            await fetch('/todos/' + todoId + '/toggle', { method: 'POST' });
            loadTodos();
        }

        async function deleteTodo(todoId) {
            if (confirm('למחוק את המשימה?')) {
                await fetch('/todos/' + todoId, { method: 'DELETE' });
                await loadTodos();
                lastUpdate = 0;
                await loadMessages();
            }
        }

        function renderTodos(todosData) {
            currentTodos = todosData;
            const container = document.getElementById('todo-list');
            const pending = todosData.filter(t => !t.completed).length;
            const done = todosData.filter(t => t.completed).length;
            
            document.getElementById('pending-count').textContent = pending;
            document.getElementById('done-count').textContent = done;
            
            if (todosData.length === 0) {
                container.innerHTML = '<div class="no-todos">אין משימות עדיין<br>לחץ על ⭐ ליד הודעה להוספה</div>';
                return;
            }
            
            const sorted = [...todosData].sort((a, b) => a.completed - b.completed);
            
            let html = '';
            sorted.forEach(todo => {
                const cleanContent = todo.content.replace(/<[^>]+>/g, '').substring(0, 150);
                html += '<div class="todo-item' + (todo.completed ? ' completed' : '') + '">' +
                    '<div class="todo-header">' +
                        '<div><div class="todo-sender">👤 ' + todo.sender + '</div><div class="todo-chat">💬 ' + todo.chat + '</div></div>' +
                    '</div>' +
                    '<div class="todo-content">' + cleanContent + (todo.content.length > 150 ? '...' : '') + '</div>' +
                    '<div class="todo-time">🕐 ' + todo.time + '</div>' +
                    '<div class="todo-actions">' +
                        (todo.completed 
                            ? '<button class="todo-btn undo" onclick="toggleTodo(' + todo.id + ')">↩️ בטל</button>'
                            : '<button class="todo-btn complete" onclick="toggleTodo(' + todo.id + ')">✓ בוצע</button>') +
                        '<button class="todo-btn delete" onclick="deleteTodo(' + todo.id + ')">🗑️</button>' +
                    '</div>' +
                '</div>';
            });
            container.innerHTML = html;
        }

        async function loadTodos() {
            try {
                const response = await fetch('/todos');
                const data = await response.json();
                const newUpdate = JSON.stringify(data).length;
                if (newUpdate !== lastTodoUpdate) {
                    renderTodos(data);
                    lastTodoUpdate = newUpdate;
                }
            } catch (error) {}
        }

        function renderReplies(replies) {
            if (!replies || replies.length === 0) return '';
            let html = '<div class="replies">';
            replies.forEach(reply => {
                html += '<div class="reply-message"><div class="sender">' + (reply.isSent ? '👤 אני' : '👤 ' + reply.sender) + '</div><div class="content">' + reply.content + '</div><div class="time">🕐 ' + reply.time + '</div></div>';
            });
            return html + '</div>';
        }

        function renderMessages(messagesData, isStatus = false) {
            const containerId = isStatus ? 'statuses' : 'messages';
            const container = document.getElementById(containerId);
            const countId = isStatus ? 'status-count' : 'msg-count';
            
            document.getElementById(countId).textContent = messagesData.length;
            
            if (messagesData.length === 0) {
                container.innerHTML = '<div class="no-messages">' + (isStatus ? 'ממתין לסטטוסים...' : 'ממתין להודעות...') + '</div>';
                return;
            }
            
            let html = '';
            messagesData.forEach((msg, index) => {
                const msgId = (isStatus ? 'status-' : 'msg-') + index;
                const escapedChatId = (msg.chatId || '').replace(/'/g, "\\\\'");
                const escapedContent = (msg.content || '').replace(/'/g, "\\\\'").replace(/"/g, '&quot;').substring(0, 50);
                const escapedSender = (msg.sender || '').replace(/'/g, "\\\\'");
                const escapedChat = (msg.chat || '').replace(/'/g, "\\\\'");
                const escapedTime = (msg.time || '').replace(/'/g, "\\\\'");
                const isSent = msg.isSent;
                
                let quotedHtml = msg.quotedMessage ? '<div class="quoted-message"><div class="quoted-sender">↩️ ' + msg.quotedMessage.sender + '</div><div class="quoted-content">' + msg.quotedMessage.content.substring(0, 100) + '</div></div>' : '';
                
                let mediaHtml = '';
                if (msg.mediaPath && msg.mediaType) {
                    if (msg.mediaType === 'image' || msg.mediaType === 'sticker') {
                        mediaHtml = '<div class="media-container"><a href="' + msg.mediaPath + '" target="_blank"><img src="' + msg.mediaPath + '" class="' + (msg.mediaType === 'sticker' ? 'sticker' : '') + '"></a></div>';
                    } else if (msg.mediaType === 'video') {
                        mediaHtml = '<div class="media-container"><video controls autoplay muted loop><source src="' + msg.mediaPath + '"></video></div>';
                    } else if (msg.mediaType === 'audio' || msg.mediaType === 'ptt') {
                        mediaHtml = '<div class="media-container"><audio controls><source src="' + msg.mediaPath + '"></audio></div>';
                    }
                }
                
                let linkHtml = '';
                if (msg.linkPreviews) {
                    msg.linkPreviews.forEach(p => {
                        if (p) {
                            try {
                                const img = p.images && p.images[0] ? '<img src="' + p.images[0] + '" class="link-preview-image" onerror="this.style.display=\\'none\\'">' : '';
                                linkHtml += '<div class="link-preview"><a href="' + p.url + '" target="_blank">' + img + '<div class="link-preview-content"><div class="link-preview-title">' + (p.title || '') + '</div><div class="link-preview-url">🔗 ' + new URL(p.url).hostname + '</div></div></a></div>';
                            } catch(e) {}
                        }
                    });
                }
                
                const repliesHtml = renderReplies(msg.replies);
                
                html += '<div class="message' + (isSent ? ' sent' : '') + (isStatus ? ' status-msg' : '') + '">' +
                    '<button class="delete-msg-btn" onclick="deleteMessage(' + index + ', ' + isStatus + ')" title="מחק הודעה">🗑️</button>' +
                    '<div class="sender">' + (isSent ? '👤 אני' : '👤 ' + msg.sender) + '</div>' +
                    '<div class="chat">' + (isStatus ? '🔄 סטטוס' : '💬 ' + msg.chat) + '</div>' +
                    quotedHtml +
                    (msg.content ? '<div class="content">' + msg.content + '</div>' : '') +
                    linkHtml + mediaHtml +
                    '<div class="time">🕐 ' + msg.time + '</div>' +
                    repliesHtml +
                    (!isSent && !isStatus ? '<div class="action-buttons">' +
                        '<button class="action-btn reply-btn" onclick="toggleReply(\\'' + msgId + '\\')">↩️ הגב</button>' +
                        (isInTodos(index) 
                            ? '<button class="action-btn todo-add-btn added" disabled>✓ ברשימה</button>'
                            : '<button class="action-btn todo-add-btn" onclick="addToTodo(' + index + ',\\'' + escapedSender + '\\',\\'' + escapedChat + '\\',\\'' + escapedContent + '\\',\\'' + escapedTime + '\\')">⭐ משימה</button>') +
                    '</div>' +
                    '<div class="reply-form" id="reply-' + msgId + '">' +
                        '<input type="text" class="reply-input" id="input-' + msgId + '" placeholder="כתוב תשובה..." onkeypress="if(event.key===\\'Enter\\')sendReply(\\'' + msgId + '\\',\\'' + escapedChatId + '\\',\\'' + escapedContent + '\\')">' +
                        '<button class="send-btn" onclick="sendReply(\\'' + msgId + '\\',\\'' + escapedChatId + '\\',\\'' + escapedContent + '\\')">שלח</button>' +
                        '<button class="cancel-btn" onclick="toggleReply(\\'' + msgId + '\\')">✕</button>' +
                        '<div class="status" id="status-' + msgId + '"></div>' +
                    '</div>' : '') +
                '</div>';
            });
            
            container.innerHTML = html;
        }

        async function loadMessages() {
            try {
                const response = await fetch('/messages');
                const data = await response.json();
                const newUpdate = JSON.stringify(data).length;
                if (newUpdate !== lastUpdate) {
                    renderMessages(data, false);
                    lastUpdate = newUpdate;
                }
            } catch (error) {}
        }

        async function loadStatuses() {
            try {
                const response = await fetch('/statuses');
                const data = await response.json();
                const newUpdate = JSON.stringify(data).length;
                if (newUpdate !== lastStatusUpdate) {
                    renderMessages(data, true);
                    lastStatusUpdate = newUpdate;
                }
            } catch (error) {}
        }

        loadMessages();
        loadStatuses();
        loadTodos();
        setInterval(loadMessages, 2000);
        setInterval(loadStatuses, 3000);
        setInterval(loadTodos, 3000);
    </script>
</body>
</html>`;

// יצירת קליינט וואטסאפ
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

// API - הודעות
app.get('/messages', (req, res) => res.json(messages));
app.get('/statuses', (req, res) => res.json(statuses));

app.delete('/messages/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const isStatus = req.query.isStatus === 'true';
    
    if (isStatus) {
        if (index >= 0 && index < statuses.length) {
            statuses.splice(index, 1);
            console.log('🗑️ Status deleted');
        }
    } else {
        if (index >= 0 && index < messages.length) {
            messages.splice(index, 1);
            console.log('🗑️ Message deleted');
        }
    }
    res.json({ success: true });
});

app.post('/send', async (req, res) => {
    try {
        const { chatId, message, msgIndex } = req.body;
        if (!chatId || !message) return res.json({ success: false, error: 'חסרים פרטים' });
        
        await client.sendMessage(chatId, message);
        console.log(`✅ Sent: ${message}`);
        
        if (msgIndex !== undefined && messages[msgIndex]) {
            if (!messages[msgIndex].replies) messages[msgIndex].replies = [];
            messages[msgIndex].replies.push({
                sender: 'אני', content: message, time: new Date().toLocaleString('he-IL'), isSent: true
            });
        }
        res.json({ success: true });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// API - משימות
app.get('/todos', (req, res) => res.json(todos));

app.post('/todos', (req, res) => {
    const { msgIndex, sender, chat, content, time } = req.body;
    const fullContent = messages[msgIndex]?.content || content;
    const todo = {
        id: Date.now(),
        msgIndex,
        sender,
        chat,
        content: fullContent.replace(/<[^>]+>/g, ''),
        time,
        completed: false,
        createdAt: new Date().toISOString()
    };
    todos.push(todo);
    saveTodos();
    console.log(`📋 Todo added: ${content.substring(0, 30)}...`);
    res.json({ success: true, todo });
});

app.post('/todos/:id/toggle', (req, res) => {
    const todo = todos.find(t => t.id === parseInt(req.params.id));
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        console.log(`📋 Todo ${todo.completed ? 'completed' : 'uncompleted'}`);
    }
    res.json({ success: true });
});

app.delete('/todos/:id', (req, res) => {
    todos = todos.filter(t => t.id !== parseInt(req.params.id));
    saveTodos();
    console.log(`📋 Todo deleted`);
    res.json({ success: true });
});

app.get('/', (req, res) => res.send(htmlPage));

// WhatsApp events
client.on('qr', (qr) => {
    console.log('\n========================================');
    console.log('Scan QR code with WhatsApp:');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('\n=== WhatsApp Ready ===');
    console.log('Open http://localhost:' + PORT + '\n');
    app.listen(PORT, () => console.log('Server on http://localhost:' + PORT));
});

client.on('message', async (message) => {
    try {
        const chat = await message.getChat();
        const sender = message._data.notifyName || message.from;
        const chatName = chat.name || 'פרטי';
        const chatId = message.from;
        const time = new Date().toLocaleString('he-IL');
        const isSent = message.fromMe;
        
        // בדיקה אם זה סטטוס
        const isStatus = message.from === 'status@broadcast' || chatId.includes('status');
        
        let mediaPath = null, mediaType = null, linkPreviews = [], quotedMessage = null;
        
        // תגובות (רק להודעות רגילות)
        if (!isStatus && message.hasQuotedMsg) {
            try {
                const quoted = await message.getQuotedMessage();
                if (quoted) {
                    quotedMessage = { sender: quoted.fromMe ? 'אני' : (quoted._data.notifyName || quoted.from), content: quoted.body || '[מדיה]' };
                    for (let i = messages.length - 1; i >= 0; i--) {
                        const origContent = (messages[i].content || '').replace(/<[^>]+>/g, '');
                        if (origContent.includes(quoted.body?.substring(0, 30) || '###')) {
                            if (!messages[i].replies) messages[i].replies = [];
                            messages[i].replies.push({ sender: isSent ? 'אני' : sender, content: linkify(message.body), time, isSent });
                            console.log(`↩️ Reply: ${message.body?.substring(0, 30)}...`);
                            return;
                        }
                    }
                }
            } catch (e) {}
        }
        
        // מדיה
        if (message.hasMedia) {
            try {
                const media = await message.downloadMedia();
                if (media) {
                    const mimeType = media.mimetype;
                    let ext = 'bin';
                    if (mimeType.includes('image')) { mediaType = message.type === 'sticker' ? 'sticker' : 'image'; ext = mimeType.includes('png') ? 'png' : mimeType.includes('gif') ? 'gif' : mimeType.includes('webp') ? 'webp' : 'jpg'; }
                    else if (mimeType.includes('video')) { mediaType = 'video'; ext = 'mp4'; }
                    else if (mimeType.includes('audio') || mimeType.includes('ogg')) { mediaType = message.type === 'ptt' ? 'ptt' : 'audio'; ext = mimeType.includes('ogg') ? 'ogg' : 'mp3'; }
                    
                    const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;
                    fs.writeFileSync(path.join(mediaDir, filename), media.data, 'base64');
                    mediaPath = '/media/' + filename;
                }
            } catch (e) {}
        }
        
        // קישורים
        const urls = extractUrls(message.body);
        for (const url of urls.slice(0, 2)) {
            const preview = await fetchLinkPreview(url);
            if (preview) linkPreviews.push(preview);
        }
        
        const msgData = { sender, chat: chatName, content: linkify(message.body), time, chatId, mediaPath, mediaType, linkPreviews, quotedMessage, isSent, replies: [] };
        
        if (isStatus) {
            statuses.push(msgData);
            if (statuses.length > 50) statuses = statuses.slice(-50);
            console.log(`🔄 Status from ${sender}: ${message.body?.substring(0, 30) || '[מדיה]'}...`);
        } else {
            messages.push(msgData);
            if (messages.length > 100) messages = messages.slice(-100);
            console.log(`${isSent ? '📤' : '📩'} ${sender}: ${message.body?.substring(0, 40) || '[מדיה]'}...`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
});

client.on('auth_failure', (msg) => console.error('❌ Auth:', msg));
client.on('disconnected', (reason) => console.log('🔌 Disconnected:', reason));

console.log('🚀 Starting...');
client.initialize();
