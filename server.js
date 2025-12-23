const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Онлайн қолданушылардың соңғы белсенділік уақыты (Жадта сақталады)
let onlineUsers = {}; 

// БАЗАНЫ ЖӘНЕ КЕСТЕЛЕРДІ БАСТАУ
async function initDB() {
    try {
        // Кестелерді құру: is_active бағаны VIP мәртебесін анықтайды
        await pool.query(`
            CREATE TABLE IF NOT EXISTS workers (
                id SERIAL PRIMARY KEY, 
                name TEXT, 
                phone TEXT, 
                job TEXT, 
                lat DOUBLE PRECISION, 
                lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, 
                device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS goods (
                id SERIAL PRIMARY KEY, 
                seller_name TEXT, 
                product_name TEXT, 
                price TEXT, 
                phone TEXT, 
                lat DOUBLE PRECISION, 
                lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT FALSE, 
                device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY, 
                client_name TEXT, 
                description TEXT, 
                phone TEXT, 
                lat DOUBLE PRECISION, 
                lon DOUBLE PRECISION, 
                is_active BOOLEAN DEFAULT TRUE,
                device_token TEXT, 
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Деректер базасы дайын.");
    } catch (err) { console.error("DB Init Error:", err); }
}
initDB();

// ПИНГ: Қолданушының браузерінен әр 30 сек сайын келеді
app.post('/user-ping', (req, res) => {
    const { token } = req.body;
    if (token) {
        onlineUsers[token] = Date.now();
    }
    res.json({ success: true });
});

// БАРЛЫҚ ДЕРЕКТЕРДІ АЛУ (Карта және Админ үшін)
app.get('/get-all', async (req, res) => {
    try {
        // 1. АВТОМАТТЫ ТАЗАЛАУ: 24 сағаттан асқан жазбаларды жою
        const cleanupQuery = "DELETE FROM %I WHERE created_at < NOW() - interval '24 hours'";
        await pool.query(`DELETE FROM workers WHERE created_at < NOW() - interval '24 hours'`);
        await pool.query(`DELETE FROM goods WHERE created_at < NOW() - interval '24 hours'`);
        await pool.query(`DELETE FROM orders WHERE created_at < NOW() - interval '24 hours'`);

        const w = await pool.query('SELECT * FROM workers');
        const g = await pool.query('SELECT * FROM goods');
        const o = await pool.query('SELECT * FROM orders');

        const now = Date.now();
        // Пайдаланушы соңғы 45 секундта пинг жіберсе - ОНЛАЙН
        const isOnline = (token) => (now - (onlineUsers[token] || 0)) < 45000;

        // КАРТА ҮШІН СҮЗГІ: Тек VIP (is_active=true) немесе қазір онлайн отырғандар
        const filteredWorkers = w.rows.filter(i => i.is_active || isOnline(i.device_token));
        const filteredGoods = g.rows.filter(i => i.is_active || isOnline(i.device_token));

        // Жауап: 
        // workers/goods/orders — картада көрінетіндер
        // admin_all — админ панельдегі кесте үшін (оффлайндар да көрінеді)
        res.json({ 
            workers: filteredWorkers, 
            goods: filteredGoods, 
            orders: o.rows,
            admin_all: {
                workers: w.rows,
                goods: g.rows,
                orders: o.rows
            }
        });
    } catch (err) { res.status(500).json({error: err.message}); }
});

function filterMarkers() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    markersGroup.clearLayers();
    
    // Смартфон ба, әлде компьютер ме екенін анықтау
    const isMobile = window.innerWidth < 768;

    rawData.forEach(i => {
        if (i.info.toLowerCase().includes(term)) {
            const color = i.type === 'worker' ? '#007bff' : (i.type === 'good' ? '#ffc107' : '#28a745');
            
            const m = L.marker([i.lat, i.lon], {
                icon: L.divIcon({ 
                    html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 5px rgba(0,0,0,0.3)"></div>`, 
                    className: '' 
                })
            });

            // Өшіру батырмасының логикасы
            let delBtn = "";
            if (i.device_token === myToken) {
                delBtn = `<br><button onclick="deleteItem(${i.id}, '${i.type}')" style="background:var(--danger); color:white; padding:8px; margin-top:10px; border-radius:5px; font-size:12px; width:100%;">Өшіру ❌</button>`;
            }

            // POPUP (БАСҚАНДА АШЫЛАТЫН ТЕРЕЗЕ)
            // autoPan: true - терезе ашылғанда картаны жылжытып, маркерді ортаға әкеледі
            m.bindPopup(`
                <div style="min-width:150px;">
                    <b style="color:${color}; text-transform:uppercase;">${i.type}</b><br>
                    <span style="font-size:14px; font-weight:bold;">${i.info}</span><br>
                    <a href="tel:${i.phone}" style="display:block; margin-top:5px; color:var(--success); font-weight:bold; text-decoration:none; font-size:14px;">📞 ${i.phone}</a>
                    ${delBtn}
                </div>
            `, { 
                offset: [0, -10], // Терезені маркерден сәл жоғары көтереді
                autoPan: true 
            });

            // TOOLTIP (МАРКЕР АСТЫНДАҒЫ ЖАЗУ)
            // Смартфонда (isMobile) жазуды тұрақты қылмаймыз, тек жанына барғанда көрінеді
            // Бұл картаның "қоқысқа" толып кетпеуін қамтамасыз етеді
            m.bindTooltip(i.info.substring(0,20), { 
                permanent: !isMobile, // Компьютерде тұрақты, телефонда - жоқ
                direction: 'bottom', 
                offset: [0, 10], 
                className: 'marker-label' 
            });

            markersGroup.addLayer(m);
        }
    });
}

// САҚТАУ МАРШРУТТАРЫ
app.post('/save-worker', async (req, res) => {
    try {
        const { name, phone, job, lat, lon, device_token } = req.body;
        await pool.query('INSERT INTO workers (name, phone, job, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6)', [name, phone, job, lat, lon, device_token]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-goods', async (req, res) => {
    try {
        const { name, product, price, phone, lat, lon, device_token } = req.body;
        await pool.query('INSERT INTO goods (seller_name, product_name, price, phone, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6,$7)', [name, product, price, phone, lat, lon, device_token]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

app.post('/save-order', async (req, res) => {
    try {
        const { name, description, phone, lat, lon, device_token } = req.body;
        await pool.query('INSERT INTO orders (client_name, description, phone, lat, lon, device_token) VALUES ($1,$2,$3,$4,$5,$6)', [name, description, phone, lat, lon, device_token]);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

// АДМИН: VIP СТАТУСТЫ ӨЗГЕРТУ
app.post('/admin/toggle-active', async (req, res) => {
    try {
        const { id, type, active } = req.body; 
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        await pool.query(`UPDATE ${table} SET is_active = $1 WHERE id = $2`, [active, id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({error: err.message}); }
});

// ЖОЮ: Қолданушы өз хабарламасын немесе Админ кез келгенін жоя алады
app.post('/delete-item', async (req, res) => {
    try {
        const { id, type, token } = req.body;
        const table = type === 'worker' ? 'workers' : (type === 'good' ? 'goods' : 'orders');
        
        let query, params;
        if (token === 'admin777') {
            query = `DELETE FROM ${table} WHERE id = $1`;
            params = [parseInt(id)];
        } else {
            query = `DELETE FROM ${table} WHERE id = $1 AND device_token = $2`;
            params = [parseInt(id), token];
        }
        
        await pool.query(query, params);
        res.json({success: true});
    } catch (err) { res.status(500).json({error: err.message}); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер ${PORT} портында қосылды.`));
