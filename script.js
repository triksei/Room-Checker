let isLogin = true;
let currentUserRole = "";
let currentUserEmail = "";
let currentDept = "CEAS";

// DOM
const loginScreen = document.getElementById("loginScreen");
const checkerScreen = document.getElementById("checkerScreen");
const scheduleBtn = document.getElementById("scheduleBtn");
const addBtn = document.getElementById("addBtn");
const resetBtn = document.getElementById("resetBtn");

// USER CLASS
class User {
    constructor(username, password, role) {
        this.username = username;
        this.password = password;
        this.role = role;
    }
    checkPassword(pass) {
        return this.password === pass;
    }
}

// SCHEDULE CLASS
class Schedule {
    constructor(room, day, start, end, teacher) {
        this.room = room;
        this.day = day;
        this.start = start;
        this.end = end;
        this.teacher = teacher;
    }
    isOccupied(time) {
        return time >= this.start && time <= this.end;
    }
}

// ROOMS
const rooms = {
    CEAS: ["CEAS 101", "CEAS 102"],
    COE: ["COE 201", "COE 202"],
    CME: ["CME 301", "CME 302"],
    COT: ["COT 401", "COT 402"]
};

let accounts = {};
let schedules = [];
let chartInstance = null;

// STORAGE
function saveData() {
    localStorage.setItem("accounts", JSON.stringify(accounts));
    localStorage.setItem("schedules", JSON.stringify(schedules));
}

function loadData() {
    const acc = localStorage.getItem("accounts");
    const sch = localStorage.getItem("schedules");

    if (acc) {
        const parsed = JSON.parse(acc);
        accounts = {};
        for (let u in parsed) {
            accounts[u] = new User(parsed[u].username, parsed[u].password, parsed[u].role);
        }
    }

    if (sch) {
        const parsed = JSON.parse(sch);
        schedules = parsed.map(s => new Schedule(s.room, s.day, s.start, s.end, s.teacher));
    }
}

loadData();

// LOGIN
function toggleMode() {
    isLogin = !isLogin;
    document.getElementById("title").innerText = isLogin ? "Login" : "Create Account";
}

function submitForm() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();
    const role = document.getElementById("role").value;

    if (!user || !pass || !role) {
        alert("⚠ Fill all fields");
        return;
    }

    if (isLogin) {
        if (accounts[user] && accounts[user].checkPassword(pass)) {
            currentUserRole = accounts[user].role;
            currentUserEmail = user;

            // Reset UI
            resetBtn.style.display = "none";
            addBtn.classList.add("hidden");
            scheduleBtn.classList.add("hidden");

            // Role-based access
            if (currentUserRole === "Teacher") {
                resetBtn.style.display = "block";      // can reset
                addBtn.classList.remove("hidden");     // can add schedule
                scheduleBtn.classList.remove("hidden"); // can view schedule table
            }

            loginScreen.style.display = "none";
            checkerScreen.style.display = "flex";

            generateDashboard();
            generateChart();
            filterDept("CEAS");

        } else {
            alert("❌ Invalid login");
        }
    } else {
        if (accounts[user]) {
            alert("⚠ User already exists");
            return;
        }

        accounts[user] = new User(user, pass, role);
        saveData();
        alert("✅ Account created");
        toggleMode();
    }
}

// LOGOUT
function logout() {
    checkerScreen.style.display = "none";
    loginScreen.style.display = "flex";

    // hide all teacher-only buttons
    resetBtn.style.display = "none";
    addBtn.classList.add("hidden");
    scheduleBtn.classList.add("hidden");
}

// DASHBOARD
function generateDashboard() {
    const grid = document.getElementById("roomGrid");
    grid.innerHTML = "";

    let available = 0;
    let occupied = 0;
    let soon = 0;

    const now = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = days[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);

    rooms[currentDept].forEach(room => {
        const todaySchedules = schedules
            .filter(s => s.room === room && s.day === currentDay)
            .sort((a, b) => a.start.localeCompare(b.start));

        let status = "AVAILABLE";
        let cardClass = "available";

        const active = todaySchedules.find(s => s.isOccupied(currentTime));
        if (active) {
            status = "OCCUPIED";
            cardClass = "occupied";
            occupied++;
        } else {
            const next = todaySchedules.find(s => s.start > currentTime);
            if (next) {
                const start = new Date();
                const [h, m] = next.start.split(":");
                start.setHours(h, m);
                const diff = (start - now) / 60000;
                if (diff <= 30) {
                    status = "STARTING SOON";
                    cardClass = "soon";
                    soon++;
                } else {
                    available++;
                }
            } else {
                available++;
            }
        }

        const card = document.createElement("div");
        card.className = "room-card " + cardClass;
        card.innerHTML = `<strong>${room}</strong><br>${status}<br>
                          <button onclick="checkRoomDirect('${room}')">Check Room</button>`;
        grid.appendChild(card);
    });

    document.getElementById("availableCount").innerText = available;
    document.getElementById("occupiedCount").innerText = occupied;
    document.getElementById("soonCount").innerText = soon;
}

// ADD SCHEDULE
function addSchedule() {

    let dept = tDept.value;
    let room = tRoom.value.trim().toUpperCase();
    let day = tDay.value;
    let start = tStart.value;
    let end = tEnd.value;

    // Validation
    if (!dept || !room || !start || !end) {
        alert("⚠ Please input all fields to add a schedule");
        return;
    }

    if (end <= start) {
        alert("⚠ End time must be after start time");
        return;
    }

    // CHECK if room exists in department list
    if (!rooms[dept].includes(room)) {
        rooms[dept].push(room);   // ADD new room to department
    }

    // Conflict check
    const conflict = schedules.find(s =>
        s.room === room && s.day === day &&
        ((start >= s.start && start < s.end) ||
        (end > s.start && end <= s.end) ||
        (start <= s.start && end >= s.end))
    );

    if (conflict) {
        alert(`❌ Room already booked from ${conflict.start} to ${conflict.end}`);
        return;
    }

    schedules.push(new Schedule(room, day, start, end, currentUserEmail));

    saveData();

    alert("✅ Schedule saved");

    // Refresh UI
    generateDashboard();
    generateChart();
    filterDept(dept); // refresh dropdown
}

// SHOW SCHEDULES (Teacher only)
function showSchedules() {
    if (currentUserRole !== "Teacher") return;

    const table = document.querySelector("#scheduleTable tbody");
    table.innerHTML = "";

    schedules.forEach((s, i) => {
        table.innerHTML += `
        <tr>
        <td>${s.room}</td>
        <td>${s.day}</td>
        <td>${s.start}</td>
        <td>${s.end}</td>
        <td>${s.teacher}</td>
        <td><button onclick="deleteSchedule(${i})">Delete</button></td>
        </tr>`;
    });

    hideAllCards();
    scheduleCard.classList.remove("hidden");
}

function deleteSchedule(i) {
    schedules.splice(i, 1);
    saveData();
    showSchedules();
    generateDashboard();
}

// CHECK ROOM with validation
function checkAvailability() {

    const room = document.getElementById("room").value;
    const day = document.getElementById("day").value;
    const time = document.getElementById("time").value;

    if (!room || !day || !time) {
        alert("⚠ Please input all fields to check a room");
        return;
    }

    const occupied = schedules.some(
        s => s.room === room && s.day === day && s.isOccupied(time)
    );

    if (occupied) {

        const suggestion = suggestRoom(day, time);

        if (suggestion && suggestion !== room) {

            document.getElementById("result").innerHTML =
                "❌ OCCUPIED <br> ✅ Suggested Room: <b>" + suggestion + "</b>";

        } else {

            document.getElementById("result").innerHTML =
                "❌ OCCUPIED <br> ⚠ No available rooms";

        }

    } else {

        document.getElementById("result").innerHTML = "✅ VACANT";

    }

}

function suggestRoom(day, time) {

    const allRooms = Object.values(rooms).flat();

    for (let r of allRooms) {

        const occupied = schedules.some(
            s => s.room === r && s.day === day && s.isOccupied(time)
        );

        if (!occupied) {
            return r;
        }

    }

    return null;
}

// SEARCH
function searchRoom() {
    const input = document.getElementById("searchRoom").value.toLowerCase();
    document.querySelectorAll(".room-card").forEach(card => {
        const name = card.querySelector("strong").innerText.toLowerCase();
        card.style.display = name.includes(input) ? "flex" : "none";
    });
}

// CHART
function generateChart() {

    const usage = {};

    rooms[currentDept].forEach(r => usage[r] = 0);

    schedules.forEach(s => {
        if (rooms[currentDept].includes(s.room)) {
            usage[s.room]++;
        }
    });

    const ctx = document.getElementById("usageChart");

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: "bar",
        data: {
            labels: Object.keys(usage),
            datasets: [{
                label: currentDept + " Room Usage",
                data: Object.values(usage)
            }]
        }
    });
}

// CLOCK
function updateClock() {
    const now = new Date();
    document.getElementById("liveClock").innerText =
        now.toLocaleDateString() + " | " + now.toLocaleTimeString();
}
setInterval(updateClock, 1000);

// UTIL
function clearData() {
    if (currentUserRole !== "Teacher") return; // only teacher can reset
    if (confirm("Clear all data?")) {
        localStorage.clear();
        location.reload();
    }
}

function hideAllCards() {
    document.querySelectorAll(".card").forEach(c => c.classList.add("hidden"));
}

function showDashboard() {
    hideAllCards();
    dashboardCard.classList.remove("hidden");
}

function showCheckCard() {
    hideAllCards();
    checkCard.classList.remove("hidden");
}

function showAddCard() {
    hideAllCards();
    addCard.classList.remove("hidden");
}

function toggleSidebar() {
    document.querySelector(".sidebar").classList.toggle("active");
}

function filterDept(dept) {

    currentDept = dept; // store current department

    const room = document.getElementById("room");
    room.innerHTML = "";

    rooms[dept].forEach(r => room.add(new Option(r, r)));

    generateDashboard();   // update room cards
    generateChart();       // update statistics
}

function checkRoomDirect(roomName) {
    showCheckCard();
    document.getElementById("room").value = roomName;
}

// Auto-refresh dashboard
setInterval(() => {
    if (checkerScreen.style.display === "flex") {
        generateDashboard();
    }
}, 60000);