
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;

// ------------------------------
// GAME SETTINGS
// ------------------------------

const GRAVITY = 0.16;
const FLAP_POWER = -3.4;
const PIPE_SPEED = 1.15;
const GAP_SIZE = 104;
const GROUND_HEIGHT = 12;

// ------------------------------
// GAME STATE
// ------------------------------

let gameState = "ready";
let score = 0;
let frame = 0;
let lastTime = 0;
let spawnTimer = 0;
let gameOverTime = 0;

// ------------------------------
// MUSIC
// ------------------------------

const backgroundMusic = new Audio("assets/winter-lofi.mp3");

backgroundMusic.loop = true;
backgroundMusic.volume = 0;

let musicStarted = false;
let musicMuted = false;
let musicTargetVolume = 0.22;

function startMusic() {
    if (musicMuted) return;

    if (!musicStarted) {
        backgroundMusic.play()
            .then(() => {
                musicStarted = true;
            })
            .catch(() => {
                // The browser may require another user interaction.
                musicStarted = false;
            });
    }
}

function updateMusic(delta) {
    if (!musicStarted) return;

    if (musicMuted) {
        musicTargetVolume = 0;
    } else if (gameState === "gameover") {
        musicTargetVolume = 0.07;
    } else {
        musicTargetVolume = 0.22;
    }

    const difference = musicTargetVolume - backgroundMusic.volume;
    const fadeSpeed = Math.min(1, delta * 0.0015);

    backgroundMusic.volume += difference * fadeSpeed;
}

function toggleMusic() {
    musicMuted = !musicMuted;

    if (!musicMuted) {
        startMusic();
    }
}

// ------------------------------
// CROW
// ------------------------------

const crow = {
    x: 65,
    y: 145,
    width: 16,
    height: 12,
    velocity: 0,
    rotation: 0
};

// Pixel-art crow sprite.
// Each character represents a small pixel.

const crowSprite = [
    "....KKKK......",
    "..KKKKKKKK....",
    ".KKKKKKKKKK...",
    "KKKKKKKKKKKK..",
    "KKKKKKKKKKKKK.",
    ".KKKKKKKKKKKKV",
    "..KKKKKKKKKK..",
    "...KKKKKKKK...",
    "....KKKKKK....",
    "...K..KK..K...",
    "..K...KK...K.."
];

function drawCrow() {
    const pixelSize = 1.35;

    ctx.save();

    ctx.translate(
        crow.x + crow.width / 2,
        crow.y + crow.height / 2
    );

    ctx.rotate(crow.rotation);

    const spriteWidth = crowSprite[0].length;
    const spriteHeight = crowSprite.length;

    const startX = -spriteWidth * pixelSize / 2;
    const startY = -spriteHeight * pixelSize / 2;

    for (let y = 0; y < spriteHeight; y++) {
        for (let x = 0; x < spriteWidth; x++) {
            const pixel = crowSprite[y][x];

            if (pixel === "K") {
                ctx.fillStyle = "#17151e";
            } else if (pixel === "V") {
                ctx.fillStyle = "#8c70a9";
            } else {
                continue;
            }

            ctx.fillRect(
                startX + x * pixelSize,
                startY + y * pixelSize,
                pixelSize,
                pixelSize
            );
        }
    }

    // Violet eye
    ctx.fillStyle = "#c5a7e8";
    ctx.fillRect(4, -3, 1.5, 1.5);

    // Beak
    ctx.fillStyle = "#b18c73";
    ctx.fillRect(8, 0, 3, 1);

    ctx.restore();
}

// ------------------------------
// BACKGROUND
// ------------------------------

function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);

    sky.addColorStop(0, "#22212e");
    sky.addColorStop(0.55, "#30303d");
    sky.addColorStop(1, "#1b1b27");

    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Moon
    ctx.fillStyle = "#c5bdca";
    ctx.fillRect(176, 43, 18, 18);

    ctx.fillStyle = "#22212e";
    ctx.fillRect(184, 39, 14, 17);

    // Distant silhouettes
    ctx.fillStyle = "#292936";

    for (let i = 0; i < WIDTH; i += 34) {
        const buildingHeight = 45 + ((i * 7) % 30);

        ctx.fillRect(
            i,
            HEIGHT - GROUND_HEIGHT - buildingHeight,
            22,
            buildingHeight
        );

        // Little windows
        ctx.fillStyle = "#686075";
        ctx.fillRect(i + 6, HEIGHT - GROUND_HEIGHT - buildingHeight + 12, 3, 5);
        ctx.fillRect(i + 14, HEIGHT - GROUND_HEIGHT - buildingHeight + 23, 3, 5);

        ctx.fillStyle = "#292936";
    }

    // Mist
    ctx.fillStyle = "rgba(180, 174, 195, 0.035)";
    ctx.fillRect(0, 225, WIDTH, 35);
    ctx.fillRect(0, 260, WIDTH, 25);

    // Snowy ground
    ctx.fillStyle = "#b7b4c0";
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT);

    ctx.fillStyle = "#e0dce5";
    ctx.fillRect(0, HEIGHT - GROUND_HEIGHT, WIDTH, 2);
}

// ------------------------------
// SNOW
// ------------------------------

const snowflakes = [];

for (let i = 0; i < 38; i++) {
    snowflakes.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        speed: 0.3 + Math.random() * 0.8,
        size: Math.random() > 0.75 ? 2 : 1,
        drift: Math.random() * 0.4 - 0.2
    });
}

function updateSnow(delta) {
    const step = delta / 16.67;

    snowflakes.forEach(snow => {
        snow.y += snow.speed * step;
        snow.x += snow.drift * step;

        if (snow.y > HEIGHT) {
            snow.y = -2;
            snow.x = Math.random() * WIDTH;
        }

        if (snow.x < 0) snow.x = WIDTH;
        if (snow.x > WIDTH) snow.x = 0;
    });
}

function drawSnow() {
    snowflakes.forEach(snow => {
        ctx.fillStyle = "rgba(235, 231, 244, 0.75)";
        ctx.fillRect(snow.x, snow.y, snow.size, snow.size);
    });
}

// ------------------------------
// STREETLAMP OBSTACLES
// ------------------------------

let obstacles = [];

function createObstacle() {
    const margin = 65;
    const gapY = margin + Math.random() * (HEIGHT - GROUND_HEIGHT - margin * 2);

    obstacles.push({
        x: WIDTH + 10,
        gapY: gapY,
        gap: GAP_SIZE,
        passed: false
    });
}

function drawLamp(x, y, height, fromTop) {
    if (height <= 0) return;

    const poleWidth = 5;
    const poleX = x + 12;

    // Pole
    ctx.fillStyle = "#171720";
    ctx.fillRect(poleX, y, poleWidth, height);

    // Metal highlight
    ctx.fillStyle = "#55505f";
    ctx.fillRect(poleX + 1, y, 1, height);

    // Lantern at the opening end
    const lanternY = fromTop ? y + height - 13 : y;

    // Warm glow
    ctx.fillStyle = "rgba(239, 190, 105, 0.08)";
    ctx.fillRect(x + 2, lanternY - 5, 25, 25);

    ctx.fillStyle = "#4d3c35";
    ctx.fillRect(x + 6, lanternY, 17, 13);

    ctx.fillStyle = "#d9a85f";
    ctx.fillRect(x + 8, lanternY + 2, 13, 9);

    ctx.fillStyle = "#f4d89a";
    ctx.fillRect(x + 11, lanternY + 4, 7, 5);

    // Top cap
    ctx.fillStyle = "#171720";
    ctx.fillRect(x + 5, lanternY - 3, 19, 3);
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        const gapTop = obstacle.gapY - obstacle.gap / 2;
        const gapBottom = obstacle.gapY + obstacle.gap / 2;

        drawLamp(
            obstacle.x,
            0,
            gapTop,
            true
        );

        drawLamp(
            obstacle.x,
            gapBottom,
            HEIGHT - GROUND_HEIGHT - gapBottom,
            false
        );
    });
}

// ------------------------------
// COLLISION
// ------------------------------

function checkCollision(obstacle) {
    const birdLeft = crow.x + 2;
    const birdRight = crow.x + crow.width - 2;
    const birdTop = crow.y + 2;
    const birdBottom = crow.y + crow.height - 2;

    const lampLeft = obstacle.x + 7;
    const lampRight = obstacle.x + 22;

    const gapTop = obstacle.gapY - obstacle.gap / 2;
    const gapBottom = obstacle.gapY + obstacle.gap / 2;

    const overlapsHorizontally =
        birdRight > lampLeft && birdLeft < lampRight;

    if (!overlapsHorizontally) return false;

    if (birdTop < gapTop || birdBottom > gapBottom) {
        return true;
    }

    return false;
}

// ------------------------------
// GAME FLOW
// ------------------------------

function startGame() {
    if (gameState !== "ready") return;

    gameState = "playing";
    startMusic();
    flap();
}

function flap() {
    if (gameState === "ready") {
        startGame();
        return;
    }

    if (gameState === "gameover") {
        restartGame();
        return;
    }

    crow.velocity = FLAP_POWER;
}

function gameOver() {
    if (gameState !== "playing") return;

    gameState = "gameover";
    gameOverTime = 0;
}

function restartGame() {
    crow.y = 145;
    crow.velocity = FLAP_POWER;
    crow.rotation = 0;

    obstacles = [];
    score = 0;
    frame = 0;
    spawnTimer = 0;
    gameOverTime = 0;

    gameState = "playing";
    startMusic();
}

// ------------------------------
// UPDATE GAME
// ------------------------------

function updateGame(delta) {
    const step = delta / 16.67;

    // Crow movement
    crow.velocity += GRAVITY * step;
    crow.y += crow.velocity * step;

    crow.rotation = Math.min(
        0.65,
        Math.max(-0.45, crow.velocity * 0.12)
    );

    // Ground and ceiling
    if (
        crow.y < 0 ||
        crow.y + crow.height > HEIGHT - GROUND_HEIGHT
    ) {
        gameOver();
        return;
    }

    // Spawn obstacles
    spawnTimer += delta;

    if (spawnTimer > 1650) {
        createObstacle();
        spawnTimer = 0;
    }

    // Move obstacles
    obstacles.forEach(obstacle => {
        obstacle.x -= PIPE_SPEED * step;

        if (!obstacle.passed && obstacle.x + 25 < crow.x) {
            obstacle.passed = true;
            score++;
        }

        if (checkCollision(obstacle)) {
            gameOver();
        }
    });

    obstacles = obstacles.filter(
        obstacle => obstacle.x > -35
    );
}

// ------------------------------
// TEXT AND MENUS
// ------------------------------

function drawCenteredText(text, y, size, color) {
    ctx.fillStyle = color;
    ctx.font = `${size}px "Courier New", monospace`;
    ctx.textAlign = "center";
    ctx.fillText(text, WIDTH / 2, y);
}

function drawScore() {
    ctx.textAlign = "left";
    ctx.font = "bold 15px Courier New";
    ctx.fillStyle = "rgba(15, 14, 22, 0.55)";
    ctx.fillText(score, 13, 24);

    ctx.fillStyle = "#eee7f0";
    ctx.fillText(score, 12, 23);
}

function drawReadyScreen() {
    ctx.fillStyle = "rgba(14, 13, 22, 0.72)";
    ctx.fillRect(20, 116, 200, 88);

    drawCenteredText("MIDNIGHT CROW", 139, 12, "#e5d9ed");
    drawCenteredText("A lonely little flight.", 157, 8, "#b4a9c0");
    drawCenteredText("Press SPACE or CLICK", 180, 8, "#e5c99c");
    drawCenteredText("to begin", 192, 8, "#e5c99c");
}

const poem = [
    "The snow keeps falling,",
    "soft as a whispered song.",
    "Even the smallest wings",
    "deserve somewhere to belong."
];

function drawGameOverScreen() {
    ctx.fillStyle = "rgba(13, 12, 20, 0.84)";
    ctx.fillRect(12, 96, 216, 133);

    drawCenteredText("THE LAST FLIGHT", 117, 11, "#e2d5e8");
    drawCenteredText(`You flew through ${score} lights.`, 135, 8, "#aaa1b2");

    // Reveal one poem line at a time.
    const visibleLines = Math.min(
        poem.length,
        Math.floor(gameOverTime / 650) + 1
    );

    poem.slice(0, visibleLines).forEach((line, index) => {
        drawCenteredText(
            line,
            162 + index * 12,
            8,
            "#c9bdce"
        );
    });

    if (gameOverTime > 3300) {
        drawCenteredText(
            "CLICK OR SPACE TO FLY AGAIN",
            216,
            7,
            "#e5c99c"
        );
    }
}

// ------------------------------
// INPUT
// ------------------------------

document.addEventListener("keydown", event => {
    if (
        event.code === "Space" ||
        event.code === "ArrowUp"
    ) {
        event.preventDefault();

        if (gameState === "ready") {
            startGame();
        } else {
            flap();
        }
    }

    if (event.code === "KeyM") {
        toggleMusic();
    }
});

canvas.addEventListener("pointerdown", () => {
    if (gameState === "ready") {
        startGame();
    } else {
        flap();
    }
});

// ------------------------------
// MAIN GAME LOOP
// ------------------------------

function gameLoop(timestamp) {
    const delta = lastTime === 0
        ? 16.67
        : Math.min(timestamp - lastTime, 40);

    lastTime = timestamp;

    frame++;

    // Update
    updateSnow(delta);
    updateMusic(delta);

    if (gameState === "playing") {
        updateGame(delta);
    }

    if (gameState === "gameover") {
        gameOverTime += delta;
    }

    // Draw
    drawBackground();
    drawObstacles();
    drawCrow();
    drawSnow();

    if (gameState === "playing") {
        drawScore();
    }

    if (gameState === "ready") {
        drawReadyScreen();
    }

    if (gameState === "gameover") {
        drawGameOverScreen();
    }

    requestAnimationFrame(gameLoop);
}

// Start the game
requestAnimationFrame(gameLoop);