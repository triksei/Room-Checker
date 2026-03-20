import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =======================
// FIREBASE CONFIG
// =======================
const firebaseConfig = {
    apiKey: "AIzaSyAp-64XKra7IDyzvAZIHuRn24kLpnKUjY4",
    authDomain: "room-checker-523c3.firebaseapp.com",
    projectId: "room-checker-523c3",
    storageBucket: "room-checker-523c3.appspot.com",
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
    constructor(id, username, password, role) {
        this.id = id;
        this.username = username;
        this.password = password;
        this.role = role;
    }
    checkPassword(pass) {
        return this.password === pass;
    }
}

class Schedule {
    constructor(id, dept, room, day, start, end, teacher) {
        this.id = id;
        this.dept = dept;
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
// DEFAULT ROOMS
// =======================
const defaultRooms = {
    CEAS: ["CEAS 101", "CEAS 102"],
    COE: ["COE 201", "COE 202"],
    CME: ["CME 301", "CME 302"],
    COT: ["COT 401", "COT 402"]
};

let accounts = {};
let schedules = [];
let chartInstance = null;

// =======================
// HELPERS
// =======================
function getRoomsForDept(dept) {
    const baseRooms = defaultRooms[dept] ? [...defaultRooms[dept]] : [];

    const scheduleRooms = schedules
        .filter(s => s.dept === dept)
        .map(s => s.room);

    const merged = [...new Set([...baseRooms, ...scheduleRooms])];
    return merged.sort();
}

function refreshUI() {
    if (checkerScreen.style.display === "flex") {
        generateDashboard();
        generateChart();
        updateRoomDropdown();
        updateAddRoomPlaceholder();

        const scheduleCardEl = document.getElementById("scheduleCard");
        if (scheduleCardEl && !scheduleCardEl.classList.contains("hidden")) {
            showSchedules();
        }
    }
}

function updateRoomDropdown() {
    const roomSelect = document.getElementById("room");
    if (!roomSelect) return;

    const previousValue = roomSelect.value;
    roomSelect.innerHTML = "";

    const deptRooms = getRoomsForDept(currentDept);
    deptRooms.forEach(r => roomSelect.add(new Option(r, r)));

    if (deptRooms.includes(previousValue)) {
        roomSelect.value = previousValue;
    }
}

function updateAddRoomPlaceholder() {
    const tRoom = document.getElementById("tRoom");
    if (!tRoom) return;
    tRoom.placeholder = `Enter room for ${currentDept}`;
}

// =======================
// FIREBASE: ACCOUNTS
// =======================
async function loadAccountsFromFirebase() {
    try {
        accounts = {};
        const querySnapshot = await getDocs(collection(db, "accounts"));

        querySnapshot.forEach((docSnap) => {
            const a = docSnap.data();
            accounts[a.username] = new User(
                docSnap.id,
                a.username,
                a.password,
                a.role
            );
        });
    } catch (error) {
        console.error("Error loading accounts:", error);
        alert("Failed to load accounts.");
    }
}

async function findAccountByUsername(username) {
    const q = query(collection(db, "accounts"), where("username", "==", username));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) return null;

    const docSnap = querySnapshot.docs[0];
    const data = docSnap.data();

    return new User(docSnap.id, data.username, data.password, data.role);
}

async function createAccountInFirebase(userObj) {
    return await addDoc(collection(db, "accounts"), {
        username: userObj.username,
        password: userObj.password,
        role: userObj.role
    });
}

function listenToAccounts() {
    onSnapshot(collection(db, "accounts"), (snapshot) => {
        accounts = {};

        snapshot.forEach((docSnap) => {
            const a = docSnap.data();
            accounts[a.username] = new User(
                docSnap.id,
                a.username,
                a.password,
                a.role
            );
        });
    }, (error) => {
        console.error("Realtime accounts listener error:", error);
    });
}

// =======================
// FIREBASE: SCHEDULES
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
                    s.dept || "CEAS",
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
            dept: scheduleObj.dept,
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
                    s.dept || "CEAS",
                    s.room,
                    s.day,
                    s.start,
                    s.end,
                    s.teacher
                )
            );
        });

        refreshUI();
    }, (error) => {
        console.error("Realtime schedules listener error:", error);
    });
}

// =======================
// INIT
// =======================
async function initializeAppData() {
    await loadAccountsFromFirebase();
    await loadSchedulesFromFirebase();
    listenToAccounts();
    listenToSchedules();
}

initializeAppData();

// =======================
// LOGIN
// =======================
function toggleMode() {
    isLogin = !isLogin;
    document.getElementById("title").innerText = isLogin ? "Login" : "Create Account";

    const toggleBtn = document.getElementById("toggleBtn");
    if (toggleBtn) {
        toggleBtn.innerText = isLogin ? "Create Account" : "Back to Login";
    }
}

window.toggleMode = toggleMode;

async function submitForm() {
    const user = document.getElementById("username").value.trim().toLowerCase();
    const pass = document.getElementById("password").value.trim();
    const role = document.getElementById("role").value;

    if (!user || !pass || !role) {
        alert("⚠ Fill all fields");
        return;
    }

    if (isLogin) {
        const foundUser = await findAccountByUsername(user);

        if (foundUser && foundUser.checkPassword(pass)) {
            currentUserRole = foundUser.role;
            currentUserEmail = foundUser.username;

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

            filterDept("CEAS");
            generateDashboard();
            generateChart();
            updateRoomDropdown();
        } else {
            alert("❌ Invalid login");
        }
    } else {
        const existingUser = await findAccountByUsername(user);

        if (existingUser) {
            alert("⚠ User already exists");
            return;
        }

        const newUser = new User(null, user, pass, role);
        await createAccountInFirebase(newUser);

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

    currentUserRole = "";
    currentUserEmail = "";
}

window.logout = logout;

// =======================
// DASHBOARD
// =======================
function generateDashboard() {
    const grid = document.getElementById("roomGrid");
    if (!grid) return;

    grid.innerHTML = "";

    let available = 0;
    let occupied = 0;
    let soon = 0;

    const now = new Date();
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const currentDay = days[now.getDay()];
    const currentTime = now.toTimeString().slice(0, 5);

    const deptRooms = getRoomsForDept(currentDept);

    deptRooms.forEach(room => {
        const todaySchedules = schedules
            .filter(s => s.dept === currentDept && s.room === room && s.day === currentDay)
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
                const startTime = new Date();
                const [h, m] = next.start.split(":");
                startTime.setHours(Number(h), Number(m), 0, 0);
                const diff = (startTime - now) / 60000;

                if (diff <= 30 && diff >= 0) {
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

    const conflict = schedules.find(s =>
        s.dept === dept &&
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
        dept,
        room,
        day,
        start,
        end,
        teacher: currentUserEmail
    };

    await addScheduleToFirebase(newSchedule);

    alert("✅ Schedule saved");
    filterDept(dept);

    document.getElementById("tRoom").value = "";
    document.getElementById("tStart").value = "";
    document.getElementById("tEnd").value = "";
}

window.addSchedule = addSchedule;

// =======================
// SHOW SCHEDULES
// =======================
function showSchedules() {
    if (currentUserRole !== "Teacher") return;

    const table = document.querySelector("#scheduleTable tbody");
    table.innerHTML = "";

    schedules
        .filter(s => s.dept === currentDept)
        .sort((a, b) => {
            if (a.room !== b.room) return a.room.localeCompare(b.room);
            if (a.day !== b.day) return a.day.localeCompare(b.day);
            return a.start.localeCompare(b.start);
        })
        .forEach((s, i) => {
            table.innerHTML += `
            <tr>
                <td>${s.room}</td>
                <td>${s.day}</td>
                <td>${s.start}</td>
                <td>${s.end}</td>
                <td>${s.teacher}</td>
                <td><button onclick="deleteScheduleById('${s.id}')">Delete</button></td>
            </tr>`;
        });

    hideAllCards();
    document.getElementById("scheduleCard").classList.remove("hidden");
}

window.showSchedules = showSchedules;

async function deleteScheduleById(scheduleId) {
    await deleteScheduleFromFirebase(scheduleId);
    showSchedules();
    generateDashboard();
    generateChart();
}

window.deleteScheduleById = deleteScheduleById;

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
        s => s.dept === currentDept && s.room === room && s.day === day && s.isOccupied(time)
    );

    if (occupied) {
        const suggestion = suggestRoom(currentDept, day, time);

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

function suggestRoom(dept, day, time) {
    const deptRooms = getRoomsForDept(dept);

    for (let r of deptRooms) {
        const occupied = schedules.some(
            s => s.dept === dept && s.room === r && s.day === day && s.isOccupied(time)
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
    const deptRooms = getRoomsForDept(currentDept);

    deptRooms.forEach(r => usage[r] = 0);

    schedules.forEach(s => {
        if (s.dept === currentDept && usage[s.room] !== undefined) {
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

    if (confirm("Clear all schedules and accounts from Firebase?")) {
        alert("⚠ Clear All is not enabled in this version for safety.");
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
    updateRoomDropdown();
}

window.showCheckCard = showCheckCard;

function showAddCard() {
    hideAllCards();
    document.getElementById("addCard").classList.remove("hidden");

    const tDept = document.getElementById("tDept");
    if (tDept) tDept.value = currentDept;
}

window.showAddCard = showAddCard;

function toggleSidebar() {
    document.querySelector(".sidebar").classList.toggle("active");
}

window.toggleSidebar = toggleSidebar;

function filterDept(dept) {
    currentDept = dept;
    updateRoomDropdown();
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
// BUTTON EVENTS
// =======================
document.getElementById("submitBtn")?.addEventListener("click", submitForm);
document.getElementById("toggleBtn")?.addEventListener("click", toggleMode);

// =======================
// AUTO REFRESH UI
// =======================
setInterval(() => {
    if (checkerScreen.style.display === "flex") {
        generateDashboard();
    }
}, 60000);
