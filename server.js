require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// 資料庫路徑
const LEADS_FILE = path.join(__dirname, 'leads.json');

// 初始化資料庫
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify([]));
}

function getLeads() {
  return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
}

function saveLeads(leads) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2));
}

// 首頁
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 搜尋 API
app.post('/api/leads/search', async (req, res) => {
  const { keyword } = req.body;
  
  if (!keyword) {
    res.json({ error: '請輸入關鍵字' });
    return;
  }
  
  try {
    const response = await axios.post('https://api.tavily.com/search', {
      query: keyword + ' 線上課程 講師 LINE',
      api_key: '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'
    }, { timeout: 15000 });
    
    const results = response.data.results || [];
    
    const leads = results.map(r => ({
      id: uuidv4(),
      keyword: keyword,
      title: r.title,
      url: r.url,
      content: r.content?.substring(0, 300) || '',
      source: 'Tavily',
      status: 'new',
      score: Math.round((r.score || 0) * 100),
      createdAt: new Date().toISOString()
    }));
    
    // 儲存
    const existingLeads = getLeads();
    const updatedLeads = [...leads, ...existingLeads];
    saveLeads(updatedLeads);
    
    res.json({ success: true, leads: leads, count: leads.length });
    
  } catch (error) {
    console.error('搜尋失敗:', error.message);
    res.json({ error: '搜尋失敗: ' + error.message });
  }
});

// 取得所有 leads
app.get('/api/leads', (req, res) => {
  const leads = getLeads();
  res.json(leads);
});

// 更新 lead
app.post('/api/leads/update', (req, res) => {
  const { id, status, notes } = req.body;
  const leads = getLeads();
  const index = leads.findIndex(l => l.id === id);
  
  if (index >= 0) {
    leads[index] = { ...leads[index], status, notes, updatedAt: new Date().toISOString() };
    saveLeads(leads);
  }
  
  res.json({ success: true });
});

// 刪除 lead
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const leads = getLeads().filter(l => l.id !== id);
  saveLeads(leads);
  res.json({ success: true });
});

// 匯出 CSV
app.get('/api/leads/export', (req, res) => {
  const leads = getLeads();
  
  const csv = [
    '標題,網址,內容,分數,狀態,建立日期',
    ...leads.map(l => `"${l.title}","${l.url}","${l.content}",${l.score},${l.status},${l.createdAt}`)
  ].join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
  res.send(csv);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('🚀 Leads System running on port ' + PORT);
});
