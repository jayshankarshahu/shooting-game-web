import * as THREE from '/modules/three/build/three.module.js';


let mainCharacter;
let canvasWidth
let canvasHeight
let aspectRatio = function () {
    return canvasWidth / canvasHeight
}
let mouseX = 0, mouseY = 0;
let isMouseDown = false;
let other_characters = {};

// Socket Connection
const currentUserId = crypto.randomUUID();
const ROOM_ID = '12345678-1234-5678-1234-567812345678';

const url = new URL('http://localhost:3000/socket.io');
url.searchParams.set('user_id', currentUserId);
url.searchParams.set('room_id', ROOM_ID);

let socket;


socket = io('http://localhost:3000', {
    query: {
        user_id: currentUserId,
        room_id: ROOM_ID
    }
});

// socket.emit('join_room', { user_id : currentUserId , room_id : ROOM_ID});

socket.on('user_joined', (data) => {
    if (data.user_id === currentUserId) return;

    other_characters[data.user_id] = makeCharacter(data.user_id);
    scene.add(other_characters[data.user_id]);
    console.log(other_characters);
    alert(`${data.user_id} has joined.`);
});

socket.on('user_left', (data) => {
    alert(`${data.user_id} has left.`);

    if (!other_characters[data.user_id]) return;

    scene.remove(other_characters[data.user_id]);
    delete other_characters[data.user_id];
});

socket.on('user_moved', (data) => {

    if (!other_characters[data.user_id]) return;

    let this_char = other_characters[data.user_id];

    this_char.movementQueue.push({ x: data.x, y: data.y, rotation: data.rotation });

});

socket.on('user_position', (data) => {

    if( data.user_id == currentUserId ) return;

    let this_char;

    if (other_characters[data.user_id]) {
        this_char = other_characters[data.user_id];
    } else {
        this_char = other_characters[data.user_id] = makeCharacter( scene )
        scene.add(this_char);
    }


    this_char.movementQueue.push({ x: data.x, y: data.y, rotation: data.rotation });

});

socket.on('user_shot', (data) => {
    if (!other_characters[data.user_id]) return;

    other_characters[data.user_id].shootLaser();
});

const CONFIG = await fetch_config();

const CHARACTER_WIDTH = CONFIG.character?.width || 98;
const CHARACTER_HEIGHT = CONFIG.character?.height || 75;
const CHARACTER_ENLARGEMENT = CONFIG.character?.enlargement || 1.5;
const CHARACTER_ZINDEX = CONFIG.character?.zIndex || 10;

const ENGINE_WIDTH = CONFIG.engine?.width || 14;
const ENGINE_HEIGHT = CONFIG.engine?.height || 31;
const ENGINE_ENLARGEMENT = CONFIG.engine?.enlargement || 1.5;

const LASER_WIDTH = CONFIG.laser?.width || 9;
const LASER_HEIGHT = CONFIG.laser?.height || 54;
const LASER_ENLARGEMENT = CONFIG.laser?.enlargement || 1.5;
const LASER_SPEED = CONFIG.laser?.speed || 30;
const LASER_FIRE_INTERVAL = CONFIG.laser?.fireInterval || 200;

const CHARACTER_MOVE_SPEED = CONFIG.character?.moveSpeed || 1;
const CROSSHAIR_OFFSET = CONFIG.crosshair?.offset || { x: 100, y: -50 };
const TILE_SIZE = CONFIG.map?.tileSize || 3000;
const GRID_SIZE = CONFIG.map?.gridSize || 3;

async function fetch_config() {
    try {
        const response = await fetch('/common-config');
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching config:', error);
        return null;
    }
}


const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
})
document.body.appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(50, aspectRatio(), 0.1, 1000)
camera.position.set(0, 10, 1000)

resize();

window.addEventListener("resize", resize)

const TEXTURE_LOADER = new THREE.TextureLoader();
const AUDIO_LOADER = new THREE.AudioLoader();


// Load background texture
const bgTexture = TEXTURE_LOADER.load('/assets/images/Backgrounds/black.png', () => {
    bgTexture.wrapS = THREE.RepeatWrapping;
    bgTexture.wrapT = THREE.RepeatWrapping;
    bgTexture.repeat.set(10, 10);
});

const listener = new THREE.AudioListener();
camera.add(listener);

const laserSound = new THREE.Audio(listener);
AUDIO_LOADER.load('/assets/sounds/sfx_laser1.ogg', function (buffer) {
    laserSound.setBuffer(buffer);
    laserSound.setVolume(0.5);
});

const scene = new THREE.Scene();

let bgTiles = [];

for (let x = -1; x <= 1; x++) {

    for (let y = -1; y <= 1; y++) {

        const tile = new THREE.Mesh(
            new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE),
            new THREE.MeshBasicMaterial({ map: bgTexture })
        );

        tile.position.set(x * TILE_SIZE, y * TILE_SIZE, 0);
        scene.add(tile);
        bgTiles.push(tile);

    }

}


const crosshairGeometry = new THREE.PlaneGeometry(60, 60);
const crosshairMaterial = new THREE.MeshBasicMaterial({
    map: TEXTURE_LOADER.load('/assets/images/crosshairs/crosshair094.png'),
    transparent: true
});

const crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial);
scene.add(crosshair);
crosshair.position.set(0, 0, CHARACTER_ZINDEX);

mainCharacter = makeCharacter(scene);
scene.add(mainCharacter);
mainCharacter.position.set(0, 0, 10);


document.addEventListener('mousemove', (event) => {

    mouseX = (event.clientX / canvasWidth) * 2 - 1;
    mouseY = -(event.clientY / canvasHeight) * 2 + 1;

    let vector = new THREE.Vector3(mouseX, mouseY, 0.5);
    vector.unproject(camera);
    let dir = vector.sub(camera.position).normalize();
    let distance = -camera.position.z / dir.z;
    let position = camera.position.clone().add(dir.multiplyScalar(distance));

    crosshair.position.set(position.x + CROSSHAIR_OFFSET.x, position.y + CROSSHAIR_OFFSET.y, 10);

});

document.addEventListener('mousedown', (e) => {


    isMouseDown = e.button == 0;


})

document.addEventListener('mouseup', (e) => {
    isMouseDown = false;
    e.button == 0 && mainCharacter.shootLaser();
})

setInterval(() => {

    if (isMouseDown) {

        crosshair.scale.x = 0.8;
        crosshair.scale.y = 0.8;

        mainCharacter.shootLaser();

    } else {


        setTimeout(() => {
            crosshair.scale.x = 1;
            crosshair.scale.y = 1;
        }, 100);

    }

}, LASER_FIRE_INTERVAL);


function makeCharacter(scene) { //returns the mainCharacter object

    const character = new THREE.Mesh(
        new THREE.PlaneGeometry(CHARACTER_WIDTH * CHARACTER_ENLARGEMENT, CHARACTER_HEIGHT * CHARACTER_ENLARGEMENT),
        new THREE.MeshBasicMaterial({
            map: TEXTURE_LOADER.load('/assets/images/playerShip2_orange.png'),
            transparent: true
        })
    );

    const engine = new THREE.Mesh(
        new THREE.PlaneGeometry(ENGINE_WIDTH * ENGINE_ENLARGEMENT, ENGINE_HEIGHT * ENGINE_ENLARGEMENT),
        new THREE.MeshBasicMaterial({
            map: TEXTURE_LOADER.load('/assets/images/Effects/fire16.png'),
            transparent: true
        })
    );

    let isEnlarging = true;
    const enlargeDelta = 0.2;
    const maxScaleX = 1.4;
    const maxScaleY = 1.8;

    setInterval(() => {

        let scaleX = 1;
        let scaleY = 1.2;

        if (isEnlarging) {
            scaleX -= enlargeDelta;
            scaleY -= enlargeDelta;

        } else {
            scaleX += enlargeDelta;
            scaleY += enlargeDelta;
        }

        engine.scale.set(scaleX, scaleY, 1)

        if (scaleX > maxScaleX) scaleX = 1;
        if (scaleY > maxScaleY) scaleY = 1;

        isEnlarging = !isEnlarging;

    }, 100);

    character.add(engine);
    engine.position.set(0, -70, 1);

    character.laserMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(LASER_WIDTH * LASER_ENLARGEMENT, LASER_HEIGHT * LASER_ENLARGEMENT),
        new THREE.MeshBasicMaterial({
            map: TEXTURE_LOADER.load('/assets/images/Lasers/laserRed01.png'),
            transparent: true
        })
    );

    character.laserMesh.position.set(0, 400, 1);


    character.shootLaser = function () {

        let laser = character.laserMesh.clone();
        character.add(laser);
        scene.add(laser);

        laser.rotation.set(character.rotation.x, character.rotation.y, character.rotation.z);
        laser.position.set(character.position.x, character.position.y, CHARACTER_ZINDEX);

        let characterDirectionX = character.directionX;
        let characterDirectionY = character.directionY;

        setInterval(() => {

            laser.position.x += characterDirectionX * LASER_SPEED;
            laser.position.y += characterDirectionY * LASER_SPEED;

        }, 10);

        if (laserSound.isPlaying) laserSound.stop();
        laserSound.play();

    }

    character.movementQueue = [];

    return character;

}

function isColliding(obj1, obj2, buffer = 50) {

    let dx = obj1.position.x - obj2.position.x;
    let dy = obj1.position.y - obj2.position.y;
    let distance = Math.sqrt(dx * dx + dy * dy);
    let minDistance = (obj1.geometry.parameters.width + obj2.geometry.parameters.width) / 2 + buffer;
    return distance < minDistance;

}

function resize() {
    canvasWidth = window.innerWidth
    canvasHeight = window.innerHeight
    renderer.setSize(canvasWidth, canvasHeight)
    camera.aspect = aspectRatio()
    camera.updateProjectionMatrix()
}

function updateCamera() {
    camera.position.x = mainCharacter.position.x;
    camera.position.y = mainCharacter.position.y;
}

function updateCharacter() {

    let dx = crosshair.position.x - mainCharacter.position.x;
    let dy = crosshair.position.y - mainCharacter.position.y;

    let angle = Math.atan2(dy, dx);
    mainCharacter.rotation.z = angle - Math.PI / 2;

    let distance = Math.sqrt(dx * dx + dy * dy);


    let directionX = mainCharacter.directionX = dx / distance;
    let directionY = mainCharacter.directionY = dy / distance;

    let characterNextPosX = mainCharacter.position.x + directionX * CHARACTER_MOVE_SPEED;
    let characterNextPosY = mainCharacter.position.y + directionY * CHARACTER_MOVE_SPEED;

    mainCharacter.position.x = characterNextPosX;
    mainCharacter.position.y = characterNextPosY;

    // Send move event to server
    socket.emit('move', {
        user_id: currentUserId,
        room_id: ROOM_ID,
        x: directionX,
        y: directionY,
        rotation: mainCharacter.rotation.z
    });

}

function updateOtherCharacters() {

    Object.values(other_characters).forEach(character => {

        let movement;

        while (movement = character.movementQueue.shift()) {

            character.rotation.z = movement.rotation;

            let directionX = movement.x;
            let directionY = movement.y;

            character.position.x += directionX * CHARACTER_MOVE_SPEED;
            character.position.y += directionY * CHARACTER_MOVE_SPEED;

        }

    })


}

function updateCrosshair() {

    let vector = new THREE.Vector3(mouseX, mouseY, 0.5);
    vector.unproject(camera);
    let dir = vector.sub(camera.position).normalize();
    let distance = -camera.position.z / dir.z;
    let position = camera.position.clone().add(dir.multiplyScalar(distance));

    crosshair.position.set(position.x + CROSSHAIR_OFFSET.x, position.y + CROSSHAIR_OFFSET.y, 10);

}

function updateMap() {

    bgTiles.forEach(tile => {
        let offsetX = mainCharacter.position.x - tile.position.x;
        let offsetY = mainCharacter.position.y - tile.position.y;

        if (offsetX > TILE_SIZE) tile.position.x += TILE_SIZE * GRID_SIZE;
        if (offsetX < -TILE_SIZE) tile.position.x -= TILE_SIZE * GRID_SIZE;
        if (offsetY > TILE_SIZE) tile.position.y += TILE_SIZE * GRID_SIZE;
        if (offsetY < -TILE_SIZE) tile.position.y -= TILE_SIZE * GRID_SIZE;
    });
}

function animate() {

    updateMap();
    updateCrosshair();
    updateCamera();
    updateCharacter();
    updateOtherCharacters();

    renderer.render(scene, camera);

}

renderer.setAnimationLoop(animate);
