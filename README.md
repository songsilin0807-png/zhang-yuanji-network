# 张元济社会网络关系研究系统 - 静态版

## 简介
纯HTML/CSS/JS静态网站，无需后端，可部署到任意静态托管平台。

## 文件结构
```
静态版/
├── index.html      # 主页面
├── css/
│   └── style.css   # 民国风格样式
└── js/
    └── app.js      # 核心逻辑
```

## 功能模块
1. **首页** - 系统概览 + 四大功能入口
2. **书信检索** - 4611封信件多维度搜索 + 全文查看
3. **人物社会网络** - ECharts力导向关系图，13种关系类型
4. **时空轨迹地图** - Leaflet地图 + 时间轴筛选
5. **AI问答** - 关键词匹配 + DeepSeek API

## 数据来源
所有数据从远程CDN加载（7个JSON文件），无需本地数据文件：
- 信件元数据：4611封
- 信件全文demo：100封
- 实体表：198个
- 人物关系：1369条
- 人物简介：100人
- 地理数据：488条
- 关系类型：13种

## 部署方法

### 方法1：Netlify（推荐，最简单）
1. 访问 https://app.netlify.com/drop
2. 将整个"静态版"文件夹拖拽到页面
3. 等待部署完成，获得公开访问链接

### 方法2：Vercel
1. 访问 https://vercel.com
2. 注册/登录后点击"Add New..." → "Project"
3. 上传文件夹或连接GitHub仓库
4. 部署完成获得公开链接

### 方法3：GitHub Pages
1. 创建GitHub仓库
2. 上传静态版所有文件
3. 仓库 Settings → Pages → Source选择main分支
4. 等待几分钟，访问 https://用户名.github.io/仓库名/

### 方法4：Cloudflare Pages
1. 访问 https://pages.cloudflare.com
2. 连接Git仓库或直接上传
3. 部署完成获得公开链接

### 方法5：本地预览
直接用浏览器打开 index.html 即可（需要网络连接加载远程数据和CDN库）

## 注意事项
- 网站需要网络连接（加载ECharts、Leaflet库和远程数据）
- DeepSeek API密钥已内置，如需更换请修改 js/app.js 中的 DEEPSEEK_API_KEY
- 数据文件托管在doubaocdn.com，公开可访问
