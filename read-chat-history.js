const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// יצירת קליינט וואטסאפ
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// כאשר מתקבל קוד QR
client.on('qr', (qr) => {
    console.log('\n========================================');
    console.log('Scan QR code with WhatsApp on your phone:');
    console.log('========================================\n');
    qrcode.generate(qr, { small: true });
});

// כאשר הקליינט מוכן
client.on('ready', async () => {
    console.log('\n=== WhatsApp Client Ready ===');
    console.log('Loading chats...\n');
    
    try {
        // קבלת כל הצ'אטים
        const chats = await client.getChats();
        
        console.log(`Found ${chats.length} chats:\n`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        // הצגת 10 הצ'אטים האחרונים
        const recentChats = chats.slice(0, 10);
        
        for (let i = 0; i < recentChats.length; i++) {
            const chat = recentChats[i];
            console.log(`${i + 1}. ${chat.name || 'No name'}`);
            console.log(`   ID: ${chat.id._serialized}`);
            console.log(`   Unread: ${chat.unreadCount}`);
            console.log('');
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        
        // יצירת קובץ HTML עם היסטוריה
        if (recentChats.length > 0) {
            const firstChat = recentChats[0];
            console.log(`Reading messages from: ${firstChat.name}\n`);
            
            const messages = await firstChat.fetchMessages({ limit: 50 });
            
            console.log(`Found ${messages.length} messages\n`);
            
            // יצירת HTML
            let html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <title>היסטוריית צ'אט - ${firstChat.name || 'Unknown'}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; background: #0a1628; color: #e4e6eb; padding: 20px; direction: rtl; max-width: 800px; margin: 0 auto; }
        h1 { color: #25D366; text-align: center; }
        .message { background: #1e3a5f; border-radius: 12px; padding: 15px; margin: 10px 0; }
        .message.sent { background: #0d4a3e; border-right: 4px solid #25D366; }
        .message.received { background: #1e3a5f; border-right: 4px solid #8b9dc3; }
        .sender { color: #25D366; font-weight: bold; }
        .content { margin: 8px 0; line-height: 1.5; white-space: pre-wrap; }
        .time { color: #65676b; font-size: 0.8em; }
        .content a { color: #58a6ff; }
    </style>
</head>
<body>
    <h1>💬 ${firstChat.name || 'Chat History'}</h1>
`;
            
            for (const msg of messages) {
                try {
                    const time = new Date(msg.timestamp * 1000).toLocaleString('he-IL');
                    const sender = msg._data.notifyName || msg.from || 'Unknown';
                    const isSent = msg.fromMe;
                    const content = (msg.body || '[מדיה]').replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
                    
                    html += `
    <div class="message ${isSent ? 'sent' : 'received'}">
        <div class="sender">👤 ${isSent ? 'אני' : sender}</div>
        <div class="content">${content}</div>
        <div class="time">🕐 ${time}</div>
    </div>
`;
                } catch (e) {
                    // Skip problematic messages
                }
            }
            
            html += `
</body>
</html>`;
            
            const filename = 'chat-history.html';
            fs.writeFileSync(filename, html);
            console.log(`\n✅ History saved to: ${filename}`);
            console.log('Open it in your browser to view in Hebrew RTL!\n');
        }
        
        console.log('Done!');
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
});

// טיפול בשגיאות
client.on('auth_failure', (msg) => {
    console.error('Auth error:', msg);
});

// הפעלת הקליינט
console.log('Starting WhatsApp client...');
client.initialize();
