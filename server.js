require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mysql = require('mysql2/promise');
const path = require('path');
const session = require('express-session');
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const bcrypt = require('bcryptjs');

// Register custom Handlebars helpers
const hbs = exphbs.create({
    defaultLayout: 'main',
    helpers: {
        eq: (v1, v2) => v1 === v2,
        ne: (v1, v2) => v1 !== v2
    }
});

const app = express();
const server = http.createServer(app);
const sessionMiddleware = session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
});
const io = socketIo(server);

// Database connection pool. The mysql2 library handles authentication methods automatically.
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'chat_app',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware); // Use the session middleware here

// View engine setup
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Logout error:', err);
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/');
    });
});

app.get('/chat', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    try {
        const [messages] = await pool.query(
            `SELECT m.message, m.created_at, u.username, u.profile_pic_url
            FROM messages m
            JOIN users u ON m.user_id = u.id
            ORDER BY m.created_at ASC`
        );

        const formattedMessages = messages.map(msg => ({
            ...msg,
            created_at: msg.created_at.toLocaleString('en-US', {
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            })
        }));

        res.render('chat', {
            username: req.session.user.username,
            messages: formattedMessages
        });

    } catch (error) {
        console.error('Error fetching chat history:', error);
        res.status(500).send('Error loading chat.');
    }
});

// API Routes
app.post('/api/register', async (req, res) => {
    try {
        const { username, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.execute(
            'INSERT INTO users (username, password) VALUES (?, ?)',
            [username, hashedPassword]
        );

        res.json({ success: true, userId: result.insertId });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Registration failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        const [users] = await pool.execute(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = users[0];
        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        req.session.user = { id: user.id, username: user.username };
        res.json({ success: true, userId: user.id });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Login failed' });
    }
});

// Middleware to expose session to Socket.IO
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('New user connected');

    const user = socket.request.session.user;
    if (!user) {
        console.log('User not authenticated, disconnecting socket');
        socket.disconnect(true);
        return;
    }

    console.log(`User ${user.username} (ID: ${user.id}) connected`);

    socket.on('send-chat-message', async (messageData) => {
        try {
            const { message, isAnonymous } = messageData;

            let insertUserId = user.id;
            let displayName = user.username;
            let profilePicUrl = '/img/default-profile.png';

            // Fetch current user's profile picture
            const [userProfile] = await pool.execute('SELECT profile_pic_url FROM users WHERE id = ?', [user.id]);
            if (userProfile.length > 0 && userProfile[0].profile_pic_url) {
                profilePicUrl = userProfile[0].profile_pic_url;
            }

            // Handle anonymous mode: use / create dedicated anonymous user
            if (isAnonymous) {
                // Find or create the anonymous user once per request
                let anonId;
                const [anonRows] = await pool.execute("SELECT id FROM users WHERE username = 'anonymous' LIMIT 1");
                if (anonRows.length === 0) {
                    const [result] = await pool.execute(
                        "INSERT INTO users (username, password, profile_pic_url) VALUES ('anonymous', '', '/img/anonymous.png')"
                    );
                    anonId = result.insertId;
                } else {
                    anonId = anonRows[0].id;
                }

                insertUserId = anonId;
                displayName = 'anonymous';
                profilePicUrl = '/img/anonymous.png';
            }

            // Persist the message with the chosen user id (anonymous or real)
            await pool.execute(
                'INSERT INTO messages (user_id, message) VALUES (?, ?)',
                [insertUserId, message]
            );

            const broadcastData = {
                name: displayName,
                message: message,
                created_at: new Date().toISOString(),
                profile_pic_url: profilePicUrl
            };

            io.emit('chat-message', broadcastData);

        } catch (error) {
            console.error('Error saving message to database:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User ${user.username} disconnected`);
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    await initializeDatabase();
});

// Function to initialize database tables
async function initializeDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                username VARCHAR(255) NOT NULL UNIQUE,
                password VARCHAR(255) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                profile_pic_url VARCHAR(255)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS messages (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT,
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `);

        console.log('Database tables initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}