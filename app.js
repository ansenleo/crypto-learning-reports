// 加密货币学习报告系统 - 前端应用

class CryptoReportApp {
    constructor() {
        this.config = {
            apiBase: '',
            updateInterval: 5 * 60 * 1000, // 5分钟检查更新
            reportInterval: 4 * 60 * 60 * 1000 // 4小时报告间隔
        };
        
        this.state = {
            lastUpdate: null,
            nextUpdate: null,
            reportCount: 0,
            todayCount: 0,
            progress: 35
        };
        
        this.init();
    }
    
    init() {
        this.loadMarkedLibrary();
        this.setupEventListeners();
        this.loadAllData();
        this.startAutoUpdate();
        this.updateTimeInfo();
    }
    
    loadMarkedLibrary() {
        // 如果marked未加载，动态加载
        if (typeof marked === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/marked/marked.min.js';
            script.onload = () => this.onMarkedLoaded();
            document.head.appendChild(script);
        } else {
            this.onMarkedLoaded();
        }
    }
    
    onMarkedLoaded() {
        // 配置marked
        marked.setOptions({
            breaks: true,
            gfm: true,
            headerIds: true,
            mangle: false
        });
        
        this.markedReady = true;
        this.loadLatestReport();
    }
    
    setupEventListeners() {
        // 刷新按钮
        document.getElementById('refresh-btn')?.addEventListener('click', () => {
            this.loadAllData();
            this.showToast('正在刷新数据...', 'info');
        });
        
        // 自动更新切换
        document.getElementById('auto-update-toggle')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.startAutoUpdate();
                this.showToast('已启用自动更新', 'success');
            } else {
                this.stopAutoUpdate();
                this.showToast('已禁用自动更新', 'warning');
            }
        });
    }
    
    async loadAllData() {
        try {
            await Promise.all([
                this.loadLatestReport(),
                this.loadReportList(),
                this.loadStats(),
                this.loadLearningProgress()
            ]);
            
            this.state.lastUpdate = new Date();
            this.updateTimeInfo();
            
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showToast('加载数据失败，请刷新页面', 'error');
        }
    }
    
    async loadLatestReport() {
        if (!this.markedReady) return;
        
        const container = document.getElementById('latest-report');
        if (!container) return;
        
        try {
            container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载最新报告...</div>';
            
            const response = await fetch('latest.md');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const markdown = await response.text();
            const html = marked.parse(markdown);
            
            container.innerHTML = `
                <div class="report-card">
                    <div class="report-header">
                        <h4><i class="fas fa-file-alt"></i> 最新报告</h4>
                        <span class="report-time">${this.formatTime(new Date())}</span>
                    </div>
                    <div class="markdown-content">${html}</div>
                    <div class="report-actions">
                        <a href="latest.md" download class="btn btn-outline">
                            <i class="fas fa-download"></i> 下载
                        </a>
                        <a href="latest.md" target="_blank" class="btn btn-outline">
                            <i class="fas fa-external-link-alt"></i> 原始文件
                        </a>
                    </div>
                </div>
            `;
            
        } catch (error) {
            container.innerHTML = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>加载报告失败: ${error.message}</p>
                    <button onclick="app.loadLatestReport()" class="btn btn-retry">
                        <i class="fas fa-redo"></i> 重试
                    </button>
                </div>
            `;
        }
    }
    
    async loadReportList() {
        const todayContainer = document.getElementById('today-reports');
        const recentContainer = document.getElementById('recent-reports');
        
        if (!todayContainer || !recentContainer) return;
        
        try {
            todayContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载今日报告...</div>';
            recentContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载历史报告...</div>';
            
            // 尝试加载索引文件
            const response = await fetch('index.md');
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const text = await response.text();
            const reports = this.parseReportsFromIndex(text);
            
            // 更新统计
            this.state.reportCount = reports.length;
            this.state.todayCount = reports.filter(r => r.isToday).length;
            
            this.updateStatsDisplay();
            
            // 显示今日报告
            const todayReports = reports.filter(r => r.isToday);
            todayContainer.innerHTML = this.renderReportList(todayReports, '今日报告');
            
            // 显示最近报告
            const recentReports = reports.slice(0, 10);
            recentContainer.innerHTML = this.renderReportList(recentReports, '最近报告');
            
        } catch (error) {
            const errorHtml = `
                <div class="error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>加载报告列表失败</p>
                </div>
            `;
            todayContainer.innerHTML = errorHtml;
            recentContainer.innerHTML = errorHtml;
        }
    }
    
    parseReportsFromIndex(text) {
        const reports = [];
        const lines = text.split('\n');
        const today = new Date().toISOString().split('T')[0];
        
        lines.forEach(line => {
            // 匹配Markdown链接格式: [2026-02-21 00:00](2026-02-21/report_00-00.md)
            const linkMatch = line.match(/\[([^\]]+)\]\(([^)]+)\)/);
            if (linkMatch) {
                const [_, title, path] = linkMatch;
                
                // 提取日期和时间
                const dateMatch = path.match(/(\d{4}-\d{2}-\d{2})\/report_(\d{2}-\d{2})\.md/);
                if (dateMatch) {
                    const [_, date, time] = dateMatch;
                    const isToday = date === today;
                    
                    reports.push({
                        title: title,
                        path: path,
                        date: date,
                        time: time.replace('-', ':'),
                        isToday: isToday,
                        timestamp: new Date(`${date}T${time.replace('-', ':')}`).getTime()
                    });
                }
            }
        });
        
        // 按时间倒序排序
        return reports.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    renderReportList(reports, title) {
        if (reports.length === 0) {
            return `<div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>暂无${title}</p>
            </div>`;
        }
        
        let html = `<div class="report-list-container">
            <h5>${title} (${reports.length}份)</h5>
            <ul class="report-list">`;
        
        reports.forEach(report => {
            html += `
                <li class="report-item">
                    <a href="${report.path}" class="report-link" target="_blank">
                        <i class="fas fa-file-alt"></i>
                        <span class="report-title">${report.time} 报告</span>
                    </a>
                    <span class="report-date">${report.isToday ? '今日' : report.date}</span>
                </li>
            `;
        });
        
        html += `</ul></div>`;
        return html;
    }
    
    async loadStats() {
        try {
            // 这里可以加载更多统计信息
            // 暂时使用模拟数据
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 更新显示
            this.updateStatsDisplay();
            
        } catch (error) {
            console.error('加载统计失败:', error);
        }
    }
    
    async loadLearningProgress() {
        try {
            // 尝试从最新报告解析进度
            const response = await fetch('latest.md');
            const text = await response.text();
            
            // 简单解析进度（实际应该从结构化数据获取）
            const progressMatch = text.match(/整体进度[：:]\s*(\d+)%/);
            if (progressMatch) {
                this.state.progress = parseInt(progressMatch[1]);
            }
            
            this.updateProgressDisplay();
            
        } catch (error) {
            console.error('加载学习进度失败:', error);
        }
    }
    
    updateStatsDisplay() {
        // 更新报告计数
        const reportCountEl = document.getElementById('report-count');
        const todayCountEl = document.getElementById('today-count');
        
        if (reportCountEl) reportCountEl.textContent = this.state.reportCount;
        if (todayCountEl) todayCountEl.textContent = this.state.todayCount;
        
        // 更新学习统计
        const statsContainer = document.getElementById('learning-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-label">社区线索</div>
                        <div class="stat-value">3个</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">学习策略</div>
                        <div class="stat-value">3种</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">模拟交易</div>
                        <div class="stat-value">准备中</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">风险评估</div>
                        <div class="stat-value">低</div>
                    </div>
                </div>
            `;
        }
    }
    
    updateProgressDisplay() {
        // 更新进度条
        const progressFill = document.getElementById('progress-fill');
        const progressValue = document.getElementById('progress-value');
        
        if (progressFill) {
            progressFill.style.width = `${this.state.progress}%`;
        }
        
        if (progressValue) {
            progressValue.textContent = `${this.state.progress}%`;
        }
    }
    
    updateTimeInfo() {
        const now = new Date();
        const nextUpdate = new Date(now.getTime() + this.config.reportInterval);
        
        // 计算距离下次更新的时间
        const timeUntilNext = nextUpdate.getTime() - now.getTime();
        const hours = Math.floor(timeUntilNext / (1000 * 60 * 60));
        const minutes = Math.floor((timeUntilNext % (1000 * 60 * 60)) / (1000 * 60));
        
        // 更新显示
        const nextUpdateEl = document.getElementById('next-update');
        const lastUpdateEl = document.getElementById('last-update');
        const lastCheckEl = document.getElementById('last-check');
        
        if (nextUpdateEl) {
            nextUpdateEl.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
        }
        
        if (lastUpdateEl) {
            lastUpdateEl.textContent = this.formatRelativeTime(now);
        }
        
        if (lastCheckEl) {
            lastCheckEl.textContent = this.formatTime(now);
        }
        
        // 更新页面标题
        document.title = `学习报告 (${this.state.progress}%) - 小泡饭 🍚`;
    }
    
    formatTime(date) {
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    }
    
    formatRelativeTime(date) {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        if (diff < 60000) { // 1分钟内
            return '刚刚';
        } else if (diff < 3600000) { // 1小时内
            const minutes = Math.floor(diff / 60000);
            return `${minutes}分钟前`;
        } else if (diff < 86400000) { // 24小时内
            const hours = Math.floor(diff / 3600000);
            return `${hours}小时前`;
        } else {
            const days = Math.floor(diff / 86400000);
            return `${days}天前`;
        }
    }
    
    startAutoUpdate() {
        this.stopAutoUpdate(); // 先停止现有的
        this.autoUpdateTimer = setInterval(() => {
            this.loadAllData();
            this.showToast('数据已自动更新', 'info');
        }, this.config.updateInterval);
    }
    
    stopAutoUpdate() {
        if (this.autoUpdateTimer) {
            clearInterval(this.autoUpdateTimer);
            this.autoUpdateTimer = null;
        }
    }
    
    showToast(message, type = 'info') {
        // 创建toast元素
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <i class="fas fa-${this.getToastIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        // 添加到页面
        document.body.appendChild(toast);
        
        // 显示动画
        setTimeout(() => toast.classList.add('show'), 10);
        
        // 3秒后移除
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }
    
    getToastIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
}

// 全局应用实例
let app;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app = new CryptoReportApp();
});

// 暴露到全局
window.app = app;