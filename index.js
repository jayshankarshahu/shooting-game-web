const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs'); 
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const port = 3000;

const rooms = new Map();
const user_connections = new Map();
const user_rooms = new Map();
const user_movement_queues = new Map();

function get_user_pos( user_id ) {

    let final_positions = {
        x : 0,
        y : 0,
        rotation : 0
    }

    user_movement_queues.get(user_id).forEach( ({ x , y , rotation }) => {
        final_positions.x += x*CONFIG.CHARACTER_MOVE_SPEED;
        final_positions.y += y*CONFIG.CHARACTER_MOVE_SPEED;
        final_positions.rotation = rotation;
    } )

    return final_positions;

}

const default_room = uuidv4();
rooms.set(default_room, []);

app.use('/assets', express.static(__dirname + '/assets'));
app.use('/modules/three', express.static('node_modules/three'));
app.use('/common-config', express.static('common-config.json'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// Load config file
const configPath = path.join(__dirname, 'common-config.json');
let CONFIG = {};

try {
    const configFile = fs.readFileSync(configPath, 'utf8');
    CONFIG = JSON.parse(configFile);
    console.log('Configuration loaded successfully');
} catch (err) {
    console.error('Error loading config file:', err);
    process.exit(1); // Exit if config can't be loaded
}

io.on('connection', (socket) => {
    
    const { room_id, user_id } = socket.handshake.query;
    if (!room_id || !user_id) return socket.disconnect();

    if (!rooms.has(room_id)) rooms.set(room_id, []);
    if (!rooms.get(room_id).includes(user_id)) rooms.get(room_id).push(user_id);

    user_connections.set(user_id, socket);
    user_rooms.set(user_id, room_id);
    user_movement_queues.set(user_id , []);

    // Notify others that a user joined
    rooms.get(room_id).forEach(uid => {

        if (uid !== user_id && user_connections.has(uid)) {

            let this_connection = user_connections.get(uid);

            this_connection.emit('user_joined', { user_id });

            let user_pos = get_user_pos(uid);

            socket.emit( 'user_position' , { user_id : uid , x : user_pos.x , y : user_pos.y , rotation : user_pos.rotation } );

        }

    });
    

    socket.on('move', ({ x, y, rotation }) => {

        const user_room = user_rooms.get(user_id);
        if (!user_room) return;

        user_movement_queues.get(user_id).push({ x, y, rotation });

        rooms.get(user_room).forEach(uid => {
            if (uid !== user_id && user_connections.has(uid)) {
                user_connections.get(uid).emit('user_moved', { user_id, x, y, rotation });
            }
        });

    });

    socket.on('shot', () => {
        const user_room = user_rooms.get(user_id);
        if (!user_room) return;

        rooms.get(user_room).forEach(uid => {
            if (uid !== user_id && user_connections.has(uid)) {
                user_connections.get(uid).emit('user_shot', { user_id });
            }
        });
    });

    socket.on('disconnect', () => {
        const user_room = user_rooms.get(user_id);
        if (user_room) {
            rooms.set(user_room, rooms.get(user_room).filter(id => id !== user_id));
            user_rooms.delete(user_id);
        }
        user_connections.delete(user_id);

        // Notify others that a user left
        if (user_room) {
            rooms.get(user_room).forEach(uid => {
                if (user_connections.has(uid)) {
                    user_connections.get(uid).emit('user_left', { user_id });
                }
            });
        }
    });
});

server.listen(port, () => {
    console.log(`App running on http://localhost:${port}`);
});
