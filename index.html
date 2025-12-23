<!DOCTYPE html>
<html lang="kk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SK-Joba | Unified Map</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.css" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster/dist/MarkerCluster.Default.css" />
    <style>
        :root { --primary: #007bff; --success: #28a745; --warning: #ffc107; --danger: #dc3545; }
        body { font-family: 'Segoe UI', sans-serif; margin: 0; background: #f4f7f6; }
        #map { height: 45vh; width: 100%; border-bottom: 3px solid var(--primary); }
        .search-box { padding: 10px; background: white; text-align: center; position: sticky; top: 0; z-index: 1000; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .search-box input { width: 90%; padding: 12px; border-radius: 25px; border: 2px solid var(--primary); outline: none; }
        
        /* КАРТОЧКАЛАРДЫҢ ҚАТАР ТҰРУЫ */
        .container { 
            padding: 15px; 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); 
            gap: 15px; 
            align-items: start;
        }
        
        .card { 
            background: white; 
            padding: 20px; 
            border-radius: 12px; 
            box-shadow: 0 4px 15px rgba(0,0,0,0.1); 
            display: flex;
            flex-direction: column;
            border-top: 5px solid var(--primary);
        }
        
        input, select, textarea, button { width: 100%; margin: 8px 0; padding: 12px; border-radius: 8px; border: 1px solid #ddd; font-size: 14px; box-sizing: border-box; }
        
        button { background: var(--primary); color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.3s; }
        button:hover { opacity: 0.8; }
        
        .vip-btn { background: var(--warning); color: black; margin-top: 5px; }
        .payment-info { background: #fff3cd; border: 1px solid #ffeeba; padding: 10px; border-radius: 8px; font-size: 12px; margin: 5px 0; color: #856404; }

        #admin-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:white; z-index:10001; padding:20px; overflow-y:auto; }
        .marker-label { background: white; border: 1px solid var(--primary); border-radius: 4px; padding: 2px 6px; font-size: 12px; font-weight: bold; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    </style>
</head>
<body>

<div class="search-box">
    <input type="text" id="searchInput" placeholder="Іздеу (Мамандық, тауар, тапсырыс...)" oninput="filterMarkers()">
</div>

<div id="map"></div>

<div class="container">
    <div class="card" style="border-top-color: var(--primary);">
        <h4>👷 Қызмет жариялау</h4>
        <input id="w_name" placeholder="Атыңыз">
        <input id="w_job" placeholder="Мамандық">
        <input id="w_phone" placeholder="Телефон">
        <div class="payment-info">
            💎 <b>VIP (490₸):</b> 24 сағат бойы картада үнемі көріну (оффлайн болсаңыз да).
        </div>
        <button onclick="saveItem('worker')">Тегін жариялау</button>
        <button class="vip-btn" onclick="initVIP('worker')">💎 VIP жариялау</button>
    </div>

    <div class="card" style="border-top-color: var(--warning);">
        <h4>📦 Тауар сату</h4>
        <input id="g_name" placeholder="Сатушы аты">
        <input id="g_prod" placeholder="Тауар атауы">
        <input id="g_price" placeholder="Бағасы">
        <input id="g_phone" placeholder="Телефон">
        <div class="payment-info">
            💎 <b>VIP (490₸):</b> 24 сағат бойы картада үнемі көріну.
        </div>
        <button onclick="saveItem('good')" style="background:var(--warning); color:black;">Тегін жариялау</button>
        <button class="vip-btn" onclick="initVIP('good')" style="background:black; color:white;">💎 VIP жариялау</button>
    </div>

    <div class="card" style="border-top-color: var(--success);">
        <h4>📋 Тапсырыс беру (Тегін)</h4>
        <input id="c_name" placeholder="Атыңыз">
        <textarea id="c_desc" placeholder="Не қажет?"></textarea>
        <input id="c_phone" placeholder="Телефон">
        <button style="background: var(--success);" onclick="saveItem('order')">Жариялау</button>
    </div>
</div>

<div id="admin-modal">
    <div style="display:flex; justify-content: space-between; align-items: center;">
        <h2>Басқару панелі</h2>
        <button onclick="location.hash=''" style="width:80px; background:var(--danger);">Жабу</button>
    </div>
    <div id="admin-content"></div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster/dist/leaflet.markercluster.js"></script>

<script>
    const API = "https://sk-joba.onrender.com";
    const myToken = localStorage.getItem('token') || Math.random().toString(36).substr(2);
    localStorage.setItem('token', myToken);

    // КАРТА ОРНАТУ
    const map = L.map('map').setView([43.2389, 76.8897], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    const markersGroup = L.markerClusterGroup();
    map.addLayer(markersGroup);

    let rawData = [];

    // ОНЛАЙН СТАТУС (ӘР 30 СЕКУНД)
    function sendPing() {
        fetch(API + '/user-ping', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ token: myToken })
        });
    }
    setInterval(sendPing, 30000);
    sendPing();

    // МӘЛІМЕТТЕРДІ САҚТАУ
    function saveItem(type) {
        let d = {}, path = '';
        if(type==='worker'){ path='/save-worker'; d={name:v('w_name'), job:v('w_job'), phone:v('w_phone')}; }
        if(type==='good'){ path='/save-goods'; d={name:v('g_name'), product:v('g_prod'), price:v('g_price'), phone:v('g_phone')}; }
        if(type==='order'){ path='/save-order'; d={name:v('c_name'), description:v('c_desc'), phone:v('c_phone')}; }

        if(!d.phone || d.phone === "") return alert("Телефон нөмірін толтырыңыз!");

        navigator.geolocation.getCurrentPosition(p => {
            d.lat = p.coords.latitude; d.lon = p.coords.longitude; d.device_token = myToken;
            
            fetch(API + path, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(d)
            }).then(() => {
                alert("Жарияланды! Сайтта онлайн болғанда картада көрінесіз.");
                loadMarkers();
            });
        }, () => alert("GPS рұқсатын беріңіз!"));
    }

    // VIP ЖАРИЯЛАУ
    function initVIP(type) {
        alert("VIP СТАТУС: 490₸ төлеңіз (Kaspi: 87017398309). \nТөлемнен кейін хабарламаңыз 24 сағат бойы ӨШПЕЙТІН болады.");
        saveItem(type);
    }

    // КАРТАДАН КӨРСЕТУ
    function loadMarkers() {
        fetch(API + '/get-all').then(r => r.json()).then(data => {
            rawData = [
                ...data.workers.map(i => ({...i, type: 'worker', info: i.job})),
                ...data.goods.map(i => ({...i, type: 'good', info: i.product_name})),
                ...data.orders.map(i => ({...i, type: 'order', info: i.description}))
            ];
            filterMarkers();
            if(document.getElementById('admin-modal').style.display === 'block') renderAdmin();
        });
    }

    function filterMarkers() {
        const term = document.getElementById('searchInput').value.toLowerCase();
        markersGroup.clearLayers();
        rawData.forEach(i => {
            if (i.info.toLowerCase().includes(term) || term === "") {
                const color = i.type === 'worker' ? '#007bff' : (i.type === 'good' ? '#ffc107' : '#28a745');
                const m = L.marker([i.lat, i.lon], {
                    icon: L.divIcon({ html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 5px rgba(0,0,0,0.5)"></div>`, className: '' })
                });
                
                let delBtn = (i.device_token === myToken) ? `<br><button onclick="deleteItem(${i.id}, '${i.type}')" style="background:red; padding:4px; font-size:10px; width:auto; color:white;">Өшіру ❌</button>` : "";
                
                m.bindPopup(`<b>${i.type.toUpperCase()}</b><br>${i.info}<br><a href="tel:${i.phone}">${i.phone}</a>${delBtn}`);
                m.bindTooltip(i.info.substring(0,20), { permanent: false, direction: 'top', className: 'marker-label' });
                markersGroup.addLayer(m);
            }
        });
    }

    function deleteItem(id, type) {
        if(!confirm("Өшіруді растайсыз ба?")) return;
        fetch(API + '/delete-item', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({id, type, token: myToken})
        }).then(() => loadMarkers());
    }

    // АДМИН ПАНЕЛЬ
    function renderAdmin() {
        let h = `<table><tr><th>Түрі</th><th>Инфо</th><th>Күйі</th><th>Әрекет</th></tr>`;
        rawData.forEach(i => {
            if(i.type !== 'order') {
                const status = i.is_active ? "💎 VIP" : "Тегін";
                const btn = !i.is_active ? `<button onclick="activate(${i.id},'${i.type}')">✅ VIP Қосу</button>` : `<button style="background:red" onclick="deleteItem(${i.id},'${i.type}')">❌ Өшіру</button>`;
                h += `<tr><td>${i.type}</td><td>${i.info}</td><td>${status}</td><td>${btn}</td></tr>`;
            }
        });
        document.getElementById('admin-content').innerHTML = h + "</table>";
    }

    function activate(id, type) {
        fetch(API + '/admin/activate', { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({id, type}) 
        }).then(() => loadMarkers());
    }

    function v(id){ return document.getElementById(id).value.trim(); }
    
    window.onhashchange = () => {
        if(location.hash === "#admin777") {
            const pass = prompt("Құпия сөз:");
            if(pass === "admin777") {
                document.getElementById('admin-modal').style.display='block'; 
                renderAdmin();
            } else { location.hash = ""; }
        } else { document.getElementById('admin-modal').style.display='none'; }
    };

    loadMarkers();
</script>
</body>
</html>
