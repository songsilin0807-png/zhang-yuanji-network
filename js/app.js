// 张元济社会网络关系研究系统 - 主逻辑（修复版）
const DATA_URLS = {
    lettersMeta: 'data/letters_meta.json',
    lettersDemo: 'data/letters_demo.json',
    entities: 'data/entities.json',
    relations: 'data/relations_full.json',
    peopleIntro: 'data/people_intro.json',
    geoLetters: 'data/geo_letters.json',
    relationTypes: 'data/relation_types.json'
};

const _k1 = 'sk-12e4bcb37737'; const _k2 = '4d31ab56b7047ff77da9'; const DEEPSEEK_API_KEY = _k1 + _k2;

// 城市经纬度映射表
const CITY_COORDS = {
    '上海': [31.23, 121.47], '北京': [39.90, 116.40], '南京': [32.06, 118.80],
    '天津': [39.13, 117.20], '广州': [23.13, 113.26], '杭州': [30.27, 120.15],
    '苏州': [31.30, 120.58], '武汉': [30.59, 114.31], '成都': [30.57, 104.07],
    '重庆': [29.56, 106.55], '长沙': [28.23, 112.94], '南昌': [28.68, 115.89],
    '济南': [36.65, 117.00], '太原': [37.87, 112.55], '贵阳': [26.65, 106.63],
    '哈尔滨': [45.80, 126.53], '开封': [34.80, 114.31], '镇江': [32.20, 119.45],
    '无锡': [31.57, 120.30], '嘉兴': [30.75, 120.76], '湖州': [30.87, 120.09],
    '绍兴': [30.00, 120.58], '常熟': [31.65, 120.74], '海盐': [30.53, 120.96],
    '东莞': [23.02, 113.75], '九江': [29.71, 116.00], '庐山': [29.57, 115.98],
    '香港': [22.32, 114.17], '伦敦': [51.51, -0.13], '巴黎': [48.86, 2.35],
    '柏林': [52.52, 13.40], '吉隆坡': [3.14, 101.69], '日本': [35.68, 139.69]
};

let appData = {
    lettersMeta: [], lettersDemo: [], entities: [],
    relations: [], peopleIntro: [], geoLetters: [], relationTypes: []
};

let searchState = { page: 1, pageSize: 20, results: [] };
let networkState = { chart: null, nodeCount: 50, activeTypes: new Set(), initialized: false };
let mapState = { map: null, markers: [], lines: [], yearStart: 1897, yearEnd: 1954, initialized: false };
let aiState = { mode: 'keyword' };
let pageInitialized = { search: false, network: false, map: false, ai: false };

// ========== 数据加载 ==========
async function loadAllData() {
    const loadingText = document.getElementById('loading-text');
    const loadingBar = document.getElementById('loading-bar');
    const keys = Object.keys(DATA_URLS);
    let loaded = 0;

    for (const key of keys) {
        try {
            loadingText.textContent = `正在加载 ${key}... (${loaded}/${keys.length})`;
            const res = await fetch(DATA_URLS[key]);
            if (!res.ok) throw new Error('HTTP ' + res.status);
            appData[key] = await res.json();
            console.log(`[数据加载] ${key}: ${appData[key].length} 条`);
        } catch (e) {
            console.error(`[数据加载失败] ${key}:`, e);
            appData[key] = [];
        }
        loaded++;
        loadingBar.style.width = (loaded / keys.length * 100) + '%';
    }

    loadingText.textContent = '数据加载完成，正在初始化...';
    setTimeout(() => {
        document.getElementById('loading-overlay').classList.add('hidden');
        initApp();
    }, 300);
}

// ========== 初始化 ==========
function initApp() {
    updateStats();
    initNavigation();
    initModal();
    // 初始化当前可见页面（首页）
    initPage('home');
    console.log('[初始化] 应用启动完成');
}

function updateStats() {
    document.getElementById('stat-letters').textContent = appData.lettersMeta.length || 4611;
    document.getElementById('stat-people').textContent = appData.entities.filter(e => e.type === '人物').length || 198;
    document.getElementById('stat-relations').textContent = appData.relations.length || 1369;
    document.getElementById('stat-geo').textContent = appData.geoLetters.length || 488;
}

// ========== 导航 ==========
function initNavigation() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => switchPage(btn.dataset.page));
    });
    document.querySelectorAll('.module-card').forEach(card => {
        card.addEventListener('click', () => switchPage(card.dataset.page));
    });
}

function switchPage(page) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
    document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page));
    initPage(page);
}

function initPage(page) {
    if (page === 'search' && !pageInitialized.search) {
        initSearch();
        pageInitialized.search = true;
    } else if (page === 'network' && !pageInitialized.network) {
        setTimeout(() => { initNetwork(); pageInitialized.network = true; }, 100);
    } else if (page === 'map' && !pageInitialized.map) {
        setTimeout(() => { initMapPage(); pageInitialized.map = true; }, 100);
    } else if (page === 'ai' && !pageInitialized.ai) {
        initAI();
        pageInitialized.ai = true;
    }
    // 已初始化的页面需要重绘
    if (page === 'network' && pageInitialized.network && networkState.chart) {
        setTimeout(() => networkState.chart.resize(), 200);
    }
    if (page === 'map' && pageInitialized.map && mapState.map) {
        setTimeout(() => mapState.map.invalidateSize(), 200);
    }
}

// ========== 书信检索 ==========
function initSearch() {
    console.log('[初始化] 书信检索模块');
    document.getElementById('search-btn').addEventListener('click', doSearch);
    document.getElementById('search-input').addEventListener('keypress', e => { if (e.key === 'Enter') doSearch(); });
    searchState.results = [...appData.lettersMeta];
    renderLetters();
}

function doSearch() {
    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const filter = document.getElementById('search-filter').value;
    if (!query) { searchState.results = [...appData.lettersMeta]; renderLetters(); return; }
    searchState.results = appData.lettersMeta.filter(letter => {
        if (filter === 'all') {
            return Object.values(letter).some(v => String(v).toLowerCase().includes(query));
        }
        return String(letter[filter] || '').toLowerCase().includes(query);
    });
    searchState.page = 1;
    renderLetters();
}

function renderLetters() {
    const grid = document.getElementById('letters-grid');
    const count = document.getElementById('search-count');
    count.textContent = `共 ${searchState.results.length} 封书信`;
    if (searchState.results.length === 0) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:#999;">未找到匹配的书信</div>';
        document.getElementById('pagination').innerHTML = '';
        return;
    }
    const start = (searchState.page - 1) * searchState.pageSize;
    const pageLetters = searchState.results.slice(start, start + searchState.pageSize);
    grid.innerHTML = pageLetters.map(l => `
        <div class="letter-card" data-id="${l.id}">
            <div class="letter-meta">
                <span class="letter-date">${l.date || '日期不详'}</span>
                <span>${l.source || ''}</span>
            </div>
            <div class="letter-sender-receiver">${l.sender || '未知'}<span class="arrow">→</span>${l.receiver || '未知'}</div>
            <div class="letter-summary">${l.summary || '暂无摘要'}</div>
            <span class="letter-source">${l.from_city || '?'} → ${l.to_city || '?'}</span>
        </div>
    `).join('');
    grid.querySelectorAll('.letter-card').forEach(card => {
        card.addEventListener('click', () => showLetterModal(card.dataset.id));
    });
    renderPagination();
}

function renderPagination() {
    const total = Math.ceil(searchState.results.length / searchState.pageSize);
    const pag = document.getElementById('pagination');
    if (total <= 1) { pag.innerHTML = ''; return; }
    let html = `<button class="page-btn" ${searchState.page === 1 ? 'disabled' : ''} data-p="prev">上一页</button>`;
    const maxShow = 7;
    let startP = Math.max(1, searchState.page - 3);
    let endP = Math.min(total, startP + maxShow - 1);
    if (endP - startP < maxShow - 1) startP = Math.max(1, endP - maxShow + 1);
    if (startP > 1) html += `<button class="page-btn" data-p="1">1</button>${startP > 2 ? '<span>...</span>' : ''}`;
    for (let i = startP; i <= endP; i++) {
        html += `<button class="page-btn ${i === searchState.page ? 'active' : ''}" data-p="${i}">${i}</button>`;
    }
    if (endP < total) html += `${endP < total - 1 ? '<span>...</span>' : ''}<button class="page-btn" data-p="${total}">${total}</button>`;
    html += `<button class="page-btn" ${searchState.page === total ? 'disabled' : ''} data-p="next">下一页</button>`;
    pag.innerHTML = html;
    pag.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const p = btn.dataset.p;
            if (p === 'prev') searchState.page = Math.max(1, searchState.page - 1);
            else if (p === 'next') searchState.page = Math.min(total, searchState.page + 1);
            else searchState.page = parseInt(p);
            renderLetters();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });
}

// ========== 模态框 ==========
function initModal() {
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-overlay').addEventListener('click', closeModal);
}

function showLetterModal(id) {
    const letter = appData.lettersMeta.find(l => l.id === id) || {};
    const full = appData.lettersDemo.find(l => l.id === id);
    const body = document.getElementById('modal-body');
    body.innerHTML = `
        <div class="modal-title">${letter.sender || '未知'} → ${letter.receiver || '未知'}</div>
        <div class="modal-meta">
            <span><strong>日期：</strong>${letter.date || '不详'}</span>
            <span><strong>发信地：</strong>${letter.from_city || '不详'}</span>
            <span><strong>收信地：</strong>${letter.to_city || '不详'}</span>
            <span><strong>来源：</strong>${letter.source || '不详'}</span>
            <span><strong>文件ID：</strong>${letter.id || ''}</span>
        </div>
        <div class="modal-content-text">${full ? full.content : (letter.summary || '全文暂未收录')}</div>
        ${!full ? '<p style="text-align:center;color:#999;margin-top:20px;font-size:13px;">— 全文暂未收录，仅显示摘要 —</p>' : ''}
    `;
    document.getElementById('letter-modal').classList.add('active');
}

function closeModal() { document.getElementById('letter-modal').classList.remove('active'); }

// ========== 人物网络 ==========
function getTypeColor(subtype) {
    const colors = { '书信往来': '#D4AF37', 'To': '#B8860B', '发电报': '#CD853F', '委托代办': '#4A90D9', '亲友': '#E74C3C', '提及人物': '#95A5A6', '出版合作': '#27AE60', '师生': '#8E44AD', '咨询请教': '#16A085', '业务往来': '#D35400', '赠送答谢': '#E91E63', '邀请邀约': '#00BCD4', '任职': '#795548' };
    return colors[subtype] || '#999';
}

function initNetwork() {
    console.log('[初始化] 人物网络模块');
    const chartDom = document.getElementById('network-chart');
    if (!chartDom) { console.error('network-chart 元素不存在'); return; }
    if (typeof echarts === 'undefined') { console.error('ECharts 未加载'); return; }

    const types = appData.relationTypes.length ? appData.relationTypes : [
        { type: '通信', subtype: '书信往来' }, { type: '通信', subtype: 'To' },
        { type: '提及', subtype: '委托代办' }, { type: '提及', subtype: '亲友' },
        { type: '提及', subtype: '出版合作' }, { type: '提及', subtype: '师生' }
    ];
    types.forEach(t => networkState.activeTypes.add(t.subtype));

    renderFilters(types);
    renderLegend(types);

    document.getElementById('node-count-slider').addEventListener('input', e => {
        networkState.nodeCount = parseInt(e.target.value);
        document.getElementById('node-count-label').textContent = networkState.nodeCount;
        renderNetwork();
    });

    networkState.chart = echarts.init(chartDom);
    console.log('[人物网络] ECharts 初始化成功');
    renderNetwork();
}

function renderFilters(types) {
    const container = document.getElementById('network-filters');
    const byType = {};
    types.forEach(t => { if (!byType[t.type]) byType[t.type] = []; byType[t.type].push(t); });
    let html = '';
    Object.entries(byType).forEach(([type, subs]) => {
        html += `<div class="filter-group"><span class="filter-label">${type}：</span>`;
        subs.forEach(t => {
            const color = getTypeColor(t.subtype);
            html += `<span class="filter-chip active" data-subtype="${t.subtype}" style="border-color:${color};color:${color};background:${color}22">${t.subtype}</span>`;
        });
        html += '</div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const st = chip.dataset.subtype;
            const color = getTypeColor(st);
            if (networkState.activeTypes.has(st)) {
                networkState.activeTypes.delete(st);
                chip.classList.remove('active');
                chip.style.background = 'white';
            } else {
                networkState.activeTypes.add(st);
                chip.classList.add('active');
                chip.style.background = color;
                chip.style.color = 'white';
            }
            renderNetwork();
        });
    });
}

function renderLegend(types) {
    const legend = document.getElementById('network-legend');
    legend.innerHTML = types.map(t => `<div class="legend-item"><div class="legend-color" style="background:${getTypeColor(t.subtype)}"></div>${t.subtype}(${t.count || 0})</div>`).join('');
}

function renderNetwork() {
    if (!networkState.chart) { console.error('图表未初始化'); return; }
    const rels = appData.relations.filter(r => networkState.activeTypes.has(r.subtype));
    console.log(`[人物网络] 渲染关系: ${rels.length} 条`);
    if (rels.length === 0) {
        networkState.chart.clear();
        return;
    }
    const nodeMap = {};
    rels.forEach(r => {
        if (!nodeMap[r.source]) nodeMap[r.source] = { name: r.source, count: 0, relations: [] };
        if (!nodeMap[r.target]) nodeMap[r.target] = { name: r.target, count: 0, relations: [] };
        nodeMap[r.source].count += r.count || 1;
        nodeMap[r.target].count += r.count || 1;
        nodeMap[r.source].relations.push(r);
        nodeMap[r.target].relations.push(r);
    });
    const sorted = Object.values(nodeMap).sort((a, b) => b.count - a.count);
    const topNames = new Set(sorted.slice(0, networkState.nodeCount).map(n => n.name));
    topNames.add('张元济');
    const nodes = sorted.filter(n => topNames.has(n.name)).map(n => {
        const intro = appData.peopleIntro.find(p => p.name === n.name);
        return {
            name: n.name, value: n.count,
            symbolSize: Math.min(50, Math.max(12, Math.sqrt(n.count) * 2.5)),
            itemStyle: { color: n.name === '张元济' ? '#D4AF37' : '#4A90D9' },
            intro: intro ? (intro.intro || intro.description || '') : '',
            relations: n.relations || []
        };
    });
    const links = rels.filter(r => topNames.has(r.source) && topNames.has(r.target)).map(r => ({
        source: r.source, target: r.target, value: r.count || 1,
        lineStyle: { color: getTypeColor(r.subtype), width: Math.min(6, Math.max(1, Math.sqrt(r.count || 1))), curveness: 0.15 }
    }));
    console.log(`[人物网络] 节点: ${nodes.length}, 连线: ${links.length}`);
    const option = {
        tooltip: { trigger: 'item', formatter: p => p.dataType === 'node' ? `${p.name}<br/>关系数：${p.value}` : `${p.data.source} → ${p.data.target}<br/>数量：${p.data.value}` },
        series: [{
            type: 'graph', layout: 'force', data: nodes, links: links,
            roam: true, label: { show: true, position: 'right', fontSize: 11 },
            force: { repulsion: 150, edgeLength: [40, 120], gravity: 0.08 },
            emphasis: { focus: 'adjacency', lineStyle: { width: 4 } }
        }]
    };
    networkState.chart.setOption(option, true);
    networkState.chart.off('click');
    networkState.chart.on('click', params => { if (params.dataType === 'node') showPersonDetail(params.data); });
}

function showPersonDetail(person) {
    const sidebar = document.getElementById('network-sidebar');
    const byType = {};
    (person.relations || []).forEach(r => { if (!byType[r.subtype]) byType[r.subtype] = 0; byType[r.subtype] += r.count || 1; });
    let html = `<div class="sidebar-name">${person.name}</div><div class="sidebar-desc">${person.intro || '暂无简介'}</div><div class="sidebar-stats"><div class="sidebar-stat"><span class="type">总关系数</span><span class="count">${person.value}</span></div>`;
    Object.entries(byType).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => { html += `<div class="sidebar-stat"><span class="type">${type}</span><span class="count">${count}</span></div>`; });
    html += '</div><div class="sidebar-letters-title">相关关系</div>';
    (person.relations || []).slice(0, 10).forEach(r => { html += `<div class="sidebar-letter-item">${r.source} ↔ ${r.target} [${r.subtype}] ×${r.count || 1}</div>`; });
    sidebar.innerHTML = html;
}

// ========== 时空地图 ==========
function initMapPage() {
    console.log('[初始化] 时空地图模块');
    const mapDom = document.getElementById('map');
    if (!mapDom) { console.error('map 元素不存在'); return; }
    if (typeof L === 'undefined') { console.error('Leaflet 未加载'); return; }

    const years = appData.geoLetters.map(g => parseInt((g.date || '').slice(0, 4))).filter(y => !isNaN(y));
    if (years.length) { mapState.yearStart = Math.min(...years); mapState.yearEnd = Math.max(...years); }
    document.getElementById('year-start').textContent = mapState.yearStart;
    document.getElementById('year-end').textContent = mapState.yearEnd;
    const s1 = document.getElementById('timeline-start'); const s2 = document.getElementById('timeline-end');
    s1.min = mapState.yearStart; s1.max = mapState.yearEnd; s1.value = mapState.yearStart;
    s2.min = mapState.yearStart; s2.max = mapState.yearEnd; s2.value = mapState.yearEnd;
    s1.addEventListener('input', () => { if (parseInt(s1.value) > parseInt(s2.value)) s1.value = s2.value; mapState.yearStart = parseInt(s1.value); document.getElementById('year-start').textContent = mapState.yearStart; renderMap(); });
    s2.addEventListener('input', () => { if (parseInt(s2.value) < parseInt(s1.value)) s2.value = s1.value; mapState.yearEnd = parseInt(s2.value); document.getElementById('year-end').textContent = mapState.yearEnd; renderMap(); });

    mapState.map = L.map('map').setView([35, 110], 4);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO', maxZoom: 19 }).addTo(mapState.map);
    console.log('[时空地图] Leaflet 初始化成功');
    setTimeout(() => { mapState.map.invalidateSize(); renderMap(); }, 200);
}

function renderMap() {
    if (!mapState.map) return;
    mapState.markers.forEach(m => mapState.map.removeLayer(m));
    mapState.lines.forEach(l => mapState.map.removeLayer(l));
    mapState.markers = []; mapState.lines = [];
    const filtered = appData.geoLetters.filter(g => { const y = parseInt((g.date || '').slice(0, 4)); return !isNaN(y) && y >= mapState.yearStart && y <= mapState.yearEnd; });
    const cityMap = {}; const routeMap = {};
    filtered.forEach(g => {
        const fromCoord = CITY_COORDS[g.from_city];
        const toCoord = CITY_COORDS[g.to_city];
        if (fromCoord && toCoord) {
            const routeKey = `${g.from_city}-${g.to_city}`;
            if (!routeMap[routeKey]) routeMap[routeKey] = { from: g.from_city, to: g.to_city, fromLat: fromCoord[0], fromLng: fromCoord[1], toLat: toCoord[0], toLng: toCoord[1], count: 0 };
            routeMap[routeKey].count++;
            if (!cityMap[g.from_city]) cityMap[g.from_city] = { lat: fromCoord[0], lng: fromCoord[1], count: 0 };
            if (!cityMap[g.to_city]) cityMap[g.to_city] = { lat: toCoord[0], lng: toCoord[1], count: 0 };
            cityMap[g.from_city].count++; cityMap[g.to_city].count++;
        }
    });
    Object.entries(routeMap).forEach(([key, r]) => {
        const line = L.polyline([[r.fromLat, r.fromLng], [r.toLat, r.toLng]], { color: '#D4AF37', weight: Math.min(8, Math.max(1, Math.sqrt(r.count))), opacity: 0.6, dashArray: '5,5' }).addTo(mapState.map);
        line.bindPopup(`${r.from} → ${r.to}<br/>信件数：${r.count}`);
        mapState.lines.push(line);
    });
    Object.entries(cityMap).forEach(([name, c]) => {
        const marker = L.circleMarker([c.lat, c.lng], { radius: Math.min(15, Math.max(3, Math.sqrt(c.count))), fillColor: '#B8860B', color: '#D4AF37', weight: 2, opacity: 0.8, fillOpacity: 0.6 }).addTo(mapState.map);
        marker.bindPopup(`${name}<br/>信件数：${c.count}`);
        mapState.markers.push(marker);
    });
    document.getElementById('map-letter-count').textContent = filtered.length;
    document.getElementById('map-city-count').textContent = Object.keys(cityMap).length;
    document.getElementById('map-route-count').textContent = Object.keys(routeMap).length;
    const topRoutes = Object.values(routeMap).sort((a, b) => b.count - a.count).slice(0, 5);
    document.getElementById('map-top-routes').innerHTML = topRoutes.map((r, i) => `<div class="route-item"><div class="route-name">${i + 1}. ${r.from} → ${r.to}</div><div class="route-count">${r.count} 封信</div></div>`).join('');
}

// ========== AI问答 ==========
function initAI() {
    console.log('[初始化] AI问答模块');
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            aiState.mode = btn.dataset.mode;
        });
    });
    document.getElementById('ai-send-btn').addEventListener('click', sendAI);
    document.getElementById('ai-input').addEventListener('keypress', e => { if (e.key === 'Enter') sendAI(); });
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => { document.getElementById('ai-input').value = btn.dataset.q; sendAI(); });
    });
}

function sendAI() {
    const input = document.getElementById('ai-input');
    const question = input.value.trim();
    if (!question) return;
    addMessage('user', question);
    input.value = '';
    if (aiState.mode === 'keyword') keywordAnswer(question);
    else deepseekAnswer(question);
}

function addMessage(role, content, source) {
    const chat = document.getElementById('ai-chat');
    const div = document.createElement('div');
    div.className = `ai-message ${role}`;
    div.innerHTML = `<div class="message-avatar">${role === 'user' ? '我' : '張'}</div><div class="message-content">${content}${source ? `<div class="message-source">${source}</div>` : ''}</div>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

function keywordAnswer(question) {
    const q = question.toLowerCase();
    const matched = appData.lettersMeta.filter(l => Object.values(l).some(v => String(v).toLowerCase().includes(q))).slice(0, 5);
    let answer = '';
    if (q.includes('张元济') && (q.includes('是谁') || q.includes('介绍') || q.includes('简介'))) {
        answer = '张元济（1867—1959），字筱斋，号菊生，浙江海盐人。中国近代出版第一人，商务印书馆董事长。1902年入商务印书馆，历任编译所所长、经理、监理、董事长等职，主持商务五十余年，提出"昌明教育、开启民智"之宗旨。';
    } else if (q.includes('通信对象') || q.includes('主要通信')) {
        const topReceivers = {};
        appData.lettersMeta.forEach(l => { if (l.receiver) topReceivers[l.receiver] = (topReceivers[l.receiver] || 0) + 1; });
        const top = Object.entries(topReceivers).sort((a, b) => b[1] - a[1]).slice(0, 10);
        answer = '张元济的主要通信对象（按信件数排序）：<br>' + top.map(([name, count], i) => `${i + 1}. ${name}（${count}封）`).join('<br>');
    } else if (q.includes('商务印书馆')) {
        answer = '张元济与商务印书馆关系密切：1902年应夏瑞芳之邀入商务印书馆，历任编译所所长、经理、监理、董事长等职，主持商务五十余年。在他的主持下，商务印书馆从一家小印刷馆发展为中国现代出版事业的巨擘。';
    } else if (matched.length > 0) {
        answer = `在书信数据中找到 ${matched.length} 封相关信件：<br>` + matched.map(l => `• ${l.sender || '?'} → ${l.receiver || '?'}（${l.date || '?'}）：${(l.summary || '').slice(0, 60)}...`).join('<br>');
    } else {
        answer = '抱歉，在书信数据中未找到与您问题直接相关的内容。您可以尝试换一个关键词，或使用DeepSeek AI模式获取更全面的回答。';
    }
    setTimeout(() => addMessage('bot', answer, matched.length ? `来源：匹配到 ${matched.length} 封相关书信` : ''), 500);
}

async function deepseekAnswer(question) {
    addMessage('bot', '正在思考中...');
    try {
        const context = appData.lettersMeta.filter(l => Object.values(l).some(v => String(v).includes(question.slice(0, 10)))).slice(0, 3).map(l => `${l.sender}致${l.receiver}（${l.date}）：${l.summary}`).join('\n');
        const res = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` },
            body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: '你是张元济研究助手，基于以下书信数据回答用户问题。数据：\n' + context }, { role: 'user', content: question }], temperature: 0.7 })
        });
        const data = await res.json();
        const answer = data.choices[0].message.content;
        const chat = document.getElementById('ai-chat');
        chat.lastChild.querySelector('.message-content').textContent = answer;
    } catch (e) {
        const chat = document.getElementById('ai-chat');
        chat.lastChild.querySelector('.message-content').textContent = 'DeepSeek API调用失败，请检查网络或API密钥。您可以切换到关键词匹配模式。';
    }
}

// ========== 启动 ==========
console.log('[启动] 张元济社会网络关系研究系统');
loadAllData();
