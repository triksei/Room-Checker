import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================
// FIREBASE CONFIG
// REPLACE WITH YOUR OWN
// =======================
const firebaseConfig = {
    apiKey: "AIzaSyAp-64XKra7IDyzvAZIHuRn24kLpnKUjY4",
    authDomain: "room-checker-523c3.firebaseapp.com",
    projectId: "room-checker-523c3",
    storageBucket: "room-checker-523c3.firebasestorage.app",
    messagingSenderId: "918701442915",
    appId: "1:918701442915:web:703dd759185d9e849c3556"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// =======================
// APP STATE
// =======================
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

// =======================
// CLASSES
// =======================
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

class Schedule {
    constructor(id, room, day, start, end, teacher) {
        this.id = id;
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

// =======================
// ROOMS
// =======================
const rooms = {
    CEAS: ["CEAS 101", "CEAS 102"],
    COE: ["COE 201", "COE 202"],
    CME: ["CME 301", "CME 302"],
    COT: ["COT 401", "COT 402"]
};

let accounts = {};
let schedules = [];
let chartInstance = null;

// =======================
// LOCAL STORAGE (ACCOUNTS ONLY)
// =======================
function saveAccounts() {
    localStorage.setItem("accounts", JSON.stringify(accounts));
}

function loadAccounts() {
    const acc = localStorage.getItem("accounts");

    if (acc) {
        const parsed = JSON.parse(acc);
        accounts = {};
        for (let u in parsed) {
            accounts[u] = new User(parsed[u].username, parsed[u].password, parsed[u].role);
        }
    }
}

loadAccounts();

// =======================
// FIREBASE (SCHEDULES)
// =======================
async function loadSchedulesFromFirebase() {
    try {
        schedules = [];
        const querySnapshot = await getDocs(collection(db, "schedules"));

        querySnapshot.forEach((docSnap) => {
            const s = docSnap.data();
            schedules.push(
                new Schedule(
                    docSnap.id,
                    s.room,
                    s.day,
                    s.start,
                    s.end,
                    s.teacher
                )
            );
        });
    } catch (error) {
        console.error("Error loading schedules:", error);
        alert("Failed to load schedules from Firebase.");
    }
}

async function addScheduleToFirebase(scheduleObj) {
    try {
        await addDoc(collection(db, "schedules"), {
            room: scheduleObj.room,
            day: scheduleObj.day,
            start: scheduleObj.start,
            end: scheduleObj.end,
            teacher: scheduleObj.teacher
        });
    } catch (error) {
        console.error("Error adding schedule:", error);
        alert("Failed to save schedule.");
    }
}

async function deleteScheduleFromFirebase(scheduleId) {
    try {
        await deleteDoc(doc(db, "schedules", scheduleId));
    } catch (error) {
        console.error("Error deleting schedule:", error);
        alert("Failed to delete schedule.");
    }
}

function listenToSchedules() {
    onSnapshot(collection(db, "schedules"), (snapshot) => {
        schedules = [];

        snapshot.forEach((docSnap) => {
            const s = docSnap.data();
            schedules.push(
                new Schedule(
                    docSnap.id,
                    s.room,
                    s.day,
                    s.start,
                    s.end,
                    s.teacher
                )
            );
        });

        if (checkerScreen.style.display === "flex") {
            generateDashboard();
            generateChart();

            if (document.getElementById("room")) {
                filterDept(currentDept);
            }

            const scheduleCardEl = document.getElementById("scheduleCard");
            if (scheduleCardEl && !scheduleCardEl.classList.contains("hidden")) {
                showSchedules();
            }
        }
    }, (error) => {
        console.error("Realtime listener error:", error);
    });
}

listenToSchedules();

// =======================
// LOGIN
// =======================
function toggleMode() {
    isLogin = !isLogin;
    document.getElementById("title").innerText = isLogin ? "Login" : "Create Account";
}

window.toggleMode = toggleMode;

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

            resetBtn.style.display = "none";
            addBtn.classList.add("hidden");
            scheduleBtn.classList.add("hidden");

            if (currentUserRole === "Teacher") {
                resetBtn.style.display = "block";
                addBtn.classList.remove("hidden");
                scheduleBtn.classList.remove("hidden");
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
        saveAccounts();
        alert("✅ Account created");
        toggleMode();
    }
}

window.submitForm = submitForm;

// =======================
// LOGOUT
// =======================
function logout() {
    checkerScreen.style.display = "none";
    loginScreen.style.display = "flex";

    resetBtn.style.display = "none";
    addBtn.classList.add("hidden");
    scheduleBtn.classList.add("hidden");
}

window.logout = logout;

// =======================
// DASHBOARD
// =======================
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
                start.setHours(Number(h), Number(m), 0, 0);
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
        card.innerHTML = `
            <strong>${room}</strong><br>${status}<br>
            <button onclick="checkRoomDirect('${room}')">Check Room</button>
        `;
        grid.appendChild(card);
    });

    document.getElementById("availableCount").innerText = available;
    document.getElementById("occupiedCount").innerText = occupied;
    document.getElementById("soonCount").innerText = soon;
}

// =======================
// ADD SCHEDULE
// =======================
async function addSchedule() {
    const dept = document.getElementById("tDept").value;
    const room = document.getElementById("tRoom").value.trim().toUpperCase();
    const day = document.getElementById("tDay").value;
    const start = document.getElementById("tStart").value;
    const end = document.getElementById("tEnd").value;

    if (!dept || !room || !day || !start || !end) {
        alert("⚠ Please input all fields to add a schedule");
        return;
    }

    if (end <= start) {
        alert("⚠ End time must be after start time");
        return;
    }

    if (!rooms[dept].includes(room)) {
        rooms[dept].push(room);
    }

    const conflict = schedules.find(s =>
        s.room === room &&
        s.day === day &&
        (
            (start >= s.start && start < s.end) ||
            (end > s.start && end <= s.end) ||
            (start <= s.start && end >= s.end)
        )
    );

    if (conflict) {
        alert(`❌ Room already booked from ${conflict.start} to ${conflict.end}`);
        return;
    }

    const newSchedule = {
        room,
        day,
        start,
        end,
        teacher: currentUserEmail
    };

    await addScheduleToFirebase(newSchedule);

    alert("✅ Schedule saved");
    generateDashboard();
    generateChart();
    filterDept(dept);
}

window.addSchedule = addSchedule;

// =======================
// SHOW SCHEDULES
// =======================
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
    document.getElementById("scheduleCard").classList.remove("hidden");
}

window.showSchedules = showSchedules;

async function deleteSchedule(i) {
    if (!schedules[i]) return;
    await deleteScheduleFromFirebase(schedules[i].id);
    showSchedules();
    generateDashboard();
    generateChart();
}

window.deleteSchedule = deleteSchedule;

// =======================
// CHECK ROOM
// =======================
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

window.checkAvailability = checkAvailability;

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

// =======================
// SEARCH
// =======================
function searchRoom() {
    const input = document.getElementById("searchRoom").value.toLowerCase();

    document.querySelectorAll(".room-card").forEach(card => {
        const name = card.querySelector("strong").innerText.toLowerCase();
        card.style.display = name.includes(input) ? "flex" : "none";
    });
}

window.searchRoom = searchRoom;

// =======================
// CHART
// =======================
function generateChart() {
    const usage = {};

    rooms[currentDept].forEach(r => usage[r] = 0);

    schedules.forEach(s => {
        if (rooms[currentDept].includes(s.room)) {
            usage[s.room]++;
        }
    });

    const ctx = document.getElementById("usageChart");

    if (!ctx) return;

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

// =======================
// CLOCK
// =======================
function updateClock() {
    const now = new Date();
    const liveClock = document.getElementById("liveClock");
    if (liveClock) {
        liveClock.innerText =
            now.toLocaleDateString() + " | " + now.toLocaleTimeString();
    }
}
setInterval(updateClock, 1000);
updateClock();

// =======================
// UTIL
// =======================
function clearData() {
    if (currentUserRole !== "Teacher") return;

    if (confirm("Clear all local account data on this device?")) {
        localStorage.removeItem("accounts");
        location.reload();
    }
}

window.clearData = clearData;

function hideAllCards() {
    document.querySelectorAll(".card").forEach(c => c.classList.add("hidden"));
}

function showDashboard() {
    hideAllCards();
    document.getElementById("dashboardCard").classList.remove("hidden");
}

window.showDashboard = showDashboard;

function showCheckCard() {
    hideAllCards();
    document.getElementById("checkCard").classList.remove("hidden");
}

window.showCheckCard = showCheckCard;

function showAddCard() {
    hideAllCards();
    document.getElementById("addCard").classList.remove("hidden");
}

window.showAddCard = showAddCard;

function toggleSidebar() {
    document.querySelector(".sidebar").classList.toggle("active");
}

window.toggleSidebar = toggleSidebar;

function filterDept(dept) {
    currentDept = dept;

    const room = document.getElementById("room");
    room.innerHTML = "";

    rooms[dept].forEach(r => room.add(new Option(r, r)));

    generateDashboard();
    generateChart();
}

window.filterDept = filterDept;

function checkRoomDirect(roomName) {
    showCheckCard();
    document.getElementById("room").value = roomName;
}

window.checkRoomDirect = checkRoomDirect;

// =======================
// AUTO REFRESH UI
// =======================
setInterval(() => {
    if (checkerScreen.style.display === "flex") {
        generateDashboard();
    }
}, 60000);
