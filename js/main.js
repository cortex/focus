//const pomodoroLength = 20 * 60 * 1000;
//const tickInterval = 30 * 1000;

const pomodoroLength = 1 * 60 * 1000;
const tickInterval = 5 * 1000;

const modes = {
    RUNNING:"RUNNING",
    FINISHED:"FINISHED",
    START: "START",
};

const initialState = {
    mode: modes.START,
    startTime: 0,
    currentTime: 0,
    endTime: 0,
    nextTick: 0,
    ticks: []
};

var state;

function saveState(state) {
    var stateStr = JSON.stringify(state);
    localStorage.setItem("pomodoro.state", stateStr);
}

function resetState(){
    var state = initialState;
    saveState(state);
    clearSchedule();
    return restoreState();
}

function restoreState() {
    var stateStr = localStorage.getItem("pomodoro.state");
    if (!stateStr){
        return initialState;
    }
    var state = JSON.parse(stateStr);
    state.startTime = new Date(state.startTime);                                                                                                                    
    state.endTime = new Date(state.endTime);
    return state;
}

function clearSchedule(){
    if (typeof tizen !== "undefined"){
    	tizen.alarm.removeAll();
    }
}

function scheduleAt(t){
        if (typeof tizen !== "undefined"){
            var appId = tizen.application.getCurrentApplication().appInfo.id;
            var alarm1 = new tizen.AlarmAbsolute(new Date(t));
            tizen.alarm.add(alarm1, appId);
        }else{
            console.log("Scheduling using setTimeout");
            var td = new Date(t) - new Date();
            console.log(td);
            setTimeout(
                td,
                function(){
                    console.log("timeout called");
                }
            );
        }
}

// Vibrate shim
function vibrate(vibes) {
    if (typeof tizen !== "undefined") {
        tizen.power.turnScreenOn();
        navigator.vibrate(vibes);
    }else{
        console.log("vibrating");
    }
}

function startPomodoro() {
    var now = Date.now();
    state.mode = modes.RUNNING;
    state.startTime = now;
    state.currentTime = now;

    state.endTime = new Date(now + pomodoroLength);
    state.ticks = [];


    // Create the ticks
    for (var i = now + tickInterval; i <= state.endTime; i += tickInterval) {
        state.ticks.push(i);
    }
    
    scheduleNextTick(state);
    scheduleAt(state.endTime);
    
    saveState(state);
    tick();
}

// Schedule exactly one next tick, skip any ones we might have missed
function scheduleNextTick(state){
	while (state.currentTime > state.nextTick) {
		state.nextTick = state.ticks.shift();
	}
	scheduleAt(state.nextTick);
}

function updateState(state, t) {
    state.currentTime = new Date(t);
    switch (state.mode) {
        case modes.FINISHED:
            break;
        case modes.RUNNING:
            if (state.currentTime >= state.nextTick){
                vibrate([200, 100, 200]);
                scheduleNextTick(state);
            }
            if (state.currentTime >= state.endTime) {
                vibrate([300, 100, 300, 100, 300, 100, 300]);
                state.mode = modes.FINISHED;
            }
            break;
        case modes.START:
            break;
    }
    return state;
}

function tick() {
    var now = Date.now();
    state = updateState(state, now);
    render(state);
    if (state.mode === modes.RUNNING) {
        window.requestAnimationFrame(tick);
    }
}

function radians(degrees) {
    return degrees / 180 * Math.PI;
}

function getArc(cx, cy, radius, angle) {
    var x = cx + radius * Math.cos(radians(angle));
    var y = cy + radius * Math.sin(radians(angle));
    return 'A' + radius + ',' + radius + ' 1 0 1 ' + x + ',' + y;
}

function circlePath(cx, cy, r, angle) {
    angle = angle > 360 ? 360 : angle;
    var firstAngle = angle > 180 ? 90 : angle - 90;
    var secondAngle = -270 + angle - 180;
    return 'M ' + cx + ' ' + cy + ' ' +
        'm ' + '0, -' + r +
        getArc(cx, cy, r, firstAngle) +
        (angle > 180 ? getArc(cx, cy, r, secondAngle) + '' : '');
}

function zeroPad(s, len){
    s = String(s);
    while(s.length < len) s = "0" + s;
    return s;
}

function formatTime(t) {
    var seconds = Math.floor(t / 1000);
    var minutes = Math.floor(seconds / 60);
    var secondPart = seconds - 60 * minutes;
    return (zeroPad(minutes, 2) + ":" + zeroPad(secondPart, 2)
    );
}

function render(state) {
    var elapsed = state.currentTime - state.startTime;
    var progress = elapsed / pomodoroLength;
    var remaining = pomodoroLength - elapsed;

    var c = document.getElementById("progress");
    c.setAttribute("d", circlePath(0, 0, 95, progress * 360));

    var mode = document.getElementById("mode");
    var label = state.mode === modes.RUNNING ? "FOCUS" : state.mode;
    mode.firstChild.data = label;

    var timeLabel = document.getElementById("time");
    var timeDisplayed;
        switch (state.mode){
            case modes.FINISHED:
                timeDisplayed = 0;
                break;
            case modes.RUNNING:
                timeDisplayed = remaining;
                break;
            case modes.START:
                timeDisplayed = pomodoroLength;
                break;
        }
    timeLabel.firstChild.data = formatTime(timeDisplayed);
}

window.onload = function () {
    document.addEventListener('tizenhwkey', function (e) {
        if (e.keyName === "back") {
            try {
                tizen.application.getCurrentApplication().exit();
            } catch (ignore) {}
        }
    });

    state = restoreState();
    
    var mainPage = document.querySelector('#main');
    mainPage.addEventListener("click", function () {
        switch (state.mode){
            case modes.FINISHED:
                state.mode = modes.START;
                break;
            case modes.START:
                startPomodoro();
            break;
        }
        tick();
    });
    
    var resetButton = document.querySelector('#reset');
    resetButton.addEventListener("click", function(event){
        state = resetState();
        event.stopPropagation();
    });
    tick();
};