'use strict';

function vectorLength(x, y) {
    return Math.sqrt(x * x + y * y);
}

function normalize(x, y) {
    let length = vectorLength(x, y);
    return { x: x / length, y: y / length, length: length };
}

function clamp(x, a, b) {
    return x < a ? a : (x > b ? b : x);
}

function wrap(x, a, b) {
    return x < a ? (b + x - a) : (x > b ? (a + x - b) : x);
}

function wrappedDifference(x, y, a, b) {
    let d1 = wrap(y, a, b) - wrap(x, a, b);
    let d2 = b - a - Math.abs(d1);
    return d1 < d2 ? d1 : d2 * -Math.sign(d1);
}

function cleanUpArray(arr) {
    if (arr.length == 0) {
        return;
    }

    let deleted = 0;
    for (let i = 0; i < arr.length - deleted; i++) {
        arr[i] = arr[i + deleted];
        if (arr[i].alive === false) {
            deleted++;
            i--;
        }
    }

    if (deleted > 0) {
        arr.splice(-deleted);
    }
}

class DrawableEntity {
    constructor(game) {
        this.game = game;
        this.ctx = game.canvasContext;
        this.canvas = this.ctx.canvas;
        this._x = 0;
        this._y = 0;
        this.radius = 0;
        this.alive = true;
    }

    get x() {
        return this._x;
    }
    set x(newX) {
        this._x = wrap(newX, 0, this.canvas.width);
    }
    get y() {
        return this._y;
    }
    set y(newY) {
        this._y = wrap(newY, 0, this.canvas.height);
    }

    circleCircleCollision(otherDrawableEntity) {
        if (this.radius <= 0 || otherDrawableEntity.radius <= 0
            || this.alive === false || otherDrawableEntity.alive === false) {
            return undefined;
        }

        let dx = wrappedDifference(this.x, otherDrawableEntity.x, 0, this.canvas.width);
        let dy = wrappedDifference(this.y, otherDrawableEntity.y, 0, this.canvas.height);

        let radiusOverlap = otherDrawableEntity.radius + this.radius - vectorLength(dx, dy);
        if (radiusOverlap > 0) {
            return { x: dx, y: dy, radiusOverlap: radiusOverlap };
        }

        return undefined;
    }

    frame(dtSec) {

    }

    draw() {
    }
}

const asteroidSizes = [18, 25, 35];

class Asteroid extends DrawableEntity {
    constructor(game, x, y, size) {
        super(game);
        this.x = x;
        this.y = y;

        let angle = Math.random() * Math.PI * 2;
        let velocity = 25 + Math.random() * 50;

        this.vx = Math.cos(angle) * velocity;
        this.vy = Math.sin(angle) * velocity;

        this.size = size;
        this.radius = asteroidSizes[size];
    }

    get velocity() {
        return vectorLength(this.vx, this.vy);
    }

    frame(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw() {
        let ctx = this.ctx;
        ctx.strokeStyle = "green";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.stroke();
    }
}

class Bullet extends DrawableEntity {
    constructor(game, x, y, vx, vy) {
        super(game);
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.radius = 5;
    }

    frame(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw() {
        let ctx = this.ctx;
        ctx.fillStyle = "red";

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.fill();
    }
}

class TrianguloEspacial extends DrawableEntity {
    constructor(game) {
        super(game);
        this.x = this.canvas.width * 0.5;
        this.y = this.canvas.height * 0.5;
        this.angle = 0;
        this.vx = 0;
        this.vy = 0;
        this.radius = 10;
        this.bulletsLock = false;
    }

    frame(dtSec) {
        let inputManager = this.game.inputManager;
        const gradPerSecond = 7;

        if (inputManager.isDown("LEFT") || inputManager.isDown("RIGHT")) {
            let sign = inputManager.isDown("LEFT") ? 1 : -1;
            this.angle -= sign * gradPerSecond * dtSec;
        }

        if (inputManager.isDown("UP")) {
            const accel = 15;
            this.vx += Math.cos(this.angle) * accel;
            this.vy += Math.sin(this.angle) * accel;
        }

        if (inputManager.isDown("SPACEBAR")) {
            if (this.bulletLock == false) {
                if (this.game.bullets.length <= 5) {
                    let bullet = new Bullet(this.game,
                        this.x, this.y,
                        Math.cos(this.angle) * 300,
                        Math.sin(this.angle) * 300);
                    this.game.bullets.push(bullet);
                    this.bulletLock = true;
                }
            }
        } else {
            this.bulletLock = false;
        }


        let curSpeed = vectorLength(this.vx, this.vy);
        if (curSpeed > 0) {
            let newSpeed = clamp(curSpeed, 0, 200);

            this.vx = this.vx * newSpeed / curSpeed;
            this.vy = this.vy * newSpeed / curSpeed;

            this.x += this.vx * dtSec;
            this.y += this.vy * dtSec;
        }
    }

    draw() {
        let ctx = this.ctx;
        ctx.strokeStyle = "red";
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.strokeStyle = "red";
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + Math.cos(this.angle) * this.radius * 1.1,
            this.y + Math.sin(this.angle) * this.radius * 1.1);
        ctx.stroke();
    }
}

class InputManager {
    constructor() {
        this.keysStatus = {};

        let keysEnum = {
            32: "SPACEBAR",
            37: "LEFT",
            38: "UP",
            39: "RIGHT",
            40: "DOWN"
        };

        let genKeyListener = (isDown) => {
            return (event) => {
                this.handler(keysEnum[event.keyCode], isDown);
                event.preventDefault();
                event.stopPropagation();
            };
        };

        window.addEventListener("keydown", genKeyListener(true), true);
        window.addEventListener("keyup", genKeyListener(false), true);
    }

    handler(key, isDown) {
        this.keysStatus[key] = isDown;
    }

    isDown(key) {
        return this.keysStatus[key] == true;
    }
}
class Game {
    constructor() {
        let canvas = document.createElement("canvas");
        document.body.appendChild(canvas);
        canvas.width = 640;
        canvas.height = 480;
        this.canvasContext = canvas.getContext("2d");

        this.inputManager = new InputManager();

        this.init();

        let onAnimationFrame = (timestampMs) => {
            this.update(timestampMs);
            window.requestAnimationFrame(onAnimationFrame);
        };

        window.requestAnimationFrame(onAnimationFrame);
    }

    init() {
        let canvas = this.canvasContext.canvas;
        this.trianguloEspacial = new TrianguloEspacial(this);
        this.bullets = [];
        this.asteroids = [new Asteroid(this, canvas.width * 0.75, canvas.height * 0.5, asteroidSizes.length - 1)];
    }

    update(timestampMs) {
        this.prevTimestamp = this.prevTimestamp == undefined ? timestampMs : this.prevTimestamp;
        let dtSec = (timestampMs - this.prevTimestamp) / 1000;
        this.prevTimestamp = timestampMs;

        let canvas = this.canvasContext.canvas;
        this.canvasContext.fillStyle = "#CCCCCC";
        this.canvasContext.fillRect(0, 0, canvas.width, canvas.height);

        this.trianguloEspacial.frame(dtSec);
        this.trianguloEspacial.draw();

        for (let asteroid of this.asteroids) {
            asteroid.frame(dtSec);
            asteroid.draw();

            if (asteroid.circleCircleCollision(this.trianguloEspacial)) {
                this.init();
            }

            for (let bullet of this.bullets) {
                let collisionVector = asteroid.circleCircleCollision(bullet);
                if (collisionVector != undefined) {
                    asteroid.alive = false;
                    bullet.alive = false;

                    if (asteroid.size > 0) {
                        let asteroidVelocity = asteroid.velocity * 1.4;

                        let { x: expulsionVectorX, y: expulsionVectorY } = normalize(-collisionVector.y, collisionVector.x);
                        for (let i = 0; i < 2; i++) {
                            let expulsionSign = (i == 0) ? 1 : -1;
                            let expulsionRadius = asteroidSizes[asteroid.size] * expulsionSign;
                            let asteroidFragment = new Asteroid(game, asteroid.x + expulsionVectorX * expulsionRadius, asteroid.y + expulsionVectorY * expulsionRadius, asteroid.size - 1);
                            asteroidFragment.vx = asteroidVelocity * expulsionVectorX * expulsionSign;
                            asteroidFragment.vy = asteroidVelocity * expulsionVectorY * expulsionSign;
                            this.asteroids.push(asteroidFragment);
                        }
                    }
                }
            }
        }

        for (let bullet of this.bullets) {
            bullet.frame(dtSec);
            bullet.draw();
        }

        cleanUpArray(this.asteroids);
        cleanUpArray(this.bullets);
    }
}

let game = new Game();
