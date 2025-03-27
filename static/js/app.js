// 全局变量
const REFRESH_INTERVAL = 10000; // 10秒
let currentPage = 1;
const itemsPerPage = 10;

// 页面加载完成后执行
$(document).ready(function () {
    // 初始化应用
    initializeApplication();
});

// 应用初始化函数 - 提高代码组织性
function initializeApplication() {
    // 加载配置
    loadConfig();

    // 初始加载数据
    loadAllData();

    // 设置定时刷新
    setupTaskRefresh();

    // 绑定所有事件处理函数
    bindEventHandlers();
}

// 事件处理绑定函数 - 将所有事件绑定集中在一起
function bindEventHandlers() {
    // 按钮事件监听
    $("#refresh-btn").click(function () {
        showLoading();
        loadAllData();
    });

    $("#start-registration").click(function () {
        startTaskManually();
    });

    $("#stop-registration").click(function () {
        stopTaskManually();
    });

    $("#search-btn").click(function () {
        filterAccounts();
    });

    $("#search-input").keypress(function (e) {
        if (e.which === 13) {
            filterAccounts();
        }
    });

    // 可以添加更多事件绑定...

    // 在bindEventHandlers函数中添加配置相关事件
    $("#edit-config-btn").click(function () {
        enableConfigForm(true);
    });

    $("#cancel-config-btn").click(function () {
        enableConfigForm(false);
        loadConfig(); // 重新加载配置
    });

    $("#config-form").submit(function (e) {
        e.preventDefault();
        saveConfig();
    });

    // 添加分页点击事件委托
    $(document).on('click', '.pagination .page-link', function (e) {
        e.preventDefault();
        const page = $(this).data('page');
        if (page && !$(this).parent().hasClass('disabled')) {
            changePage(page);
        }
    });
}

// 全局变量
let accounts = [];
let filteredAccounts = [];
let refreshTimer;

// 显示加载遮罩
function showLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.add('show');
}

// 隐藏加载遮罩
function hideLoading() {
    const loadingOverlay = document.getElementById('loading-overlay');
    loadingOverlay.classList.remove('show');
}

// 加载所有数据
function loadAllData() {
    showLoading();

    // 获取账号数据
    fetch('/accounts')
        .then(res => res.json())
        .then(data => {
            console.log('获取到账号数据:', data); // 添加调试日志

            // 检查并处理返回的数据结构
            if (Array.isArray(data)) {
                accounts = data; // 如果直接是数组
            } else if (data.accounts && Array.isArray(data.accounts)) {
                accounts = data.accounts; // 如果是包装在accounts属性中
            } else if (data.data && Array.isArray(data.data)) {
                accounts = data.data; // 如果是包装在data属性中
            } else {
                console.error('账号数据格式不正确:', data);
                accounts = [];
            }

            console.log('处理后的账号数据:', accounts);
            filteredAccounts = [...accounts];

            // 渲染账号表格
            renderAccountsTable();

            // 然后获取任务状态
            return fetch('/registration/status');
        })
        .then(res => res.json())
        .then(data => {
            console.log('获取到任务状态:', data);
            updateTaskStatusUI(data);

            hideLoading();
        })
        .catch(error => {
            console.error('加载数据失败:', error);
            hideLoading();
            showAlert('加载数据失败，请刷新页面重试', 'danger');
        });
}

// 启动定时刷新
function setupTaskRefresh() {
    // 清除可能存在的旧定时器
    if (window.taskRefreshInterval) {
        clearInterval(window.taskRefreshInterval);
    }

    // 创建新的10秒定时器
    window.taskRefreshInterval = setInterval(function () {
        // 只刷新任务状态，而不是整个页面
        refreshTaskStatus();
    }, 10000); // 10秒
}

// 只刷新任务状态部分的函数
function refreshTaskStatus() {
    fetch('/registration/status')
        .then(res => res.json())
        .then(data => {
            // 只更新任务状态区域，不重新加载账号列表
            updateTaskStatusUI(data);
        })
        .catch(error => {
            console.error('刷新任务状态时发生错误:', error);
        });
}

// 更新任务状态UI函数 - 适配实际API返回的数据结构
function updateTaskStatusUI(data) {
    console.log('收到任务状态数据:', data); // 保留调试日志

    // 数据格式兼容性处理
    const taskStatus = data || {};

    // 从正确的嵌套位置获取运行状态和任务状态
    const isRunning = taskStatus.task_status === 'running' || taskStatus.task_status === 'monitoring';
    const taskStatusValue = taskStatus.task_status;

    // 更新状态指示器，添加监控模式的样式
    if ($('#registration-status').length) {
        $('#registration-status').removeClass().addClass('badge');

        if (taskStatusValue === 'running') {
            $('#registration-status').addClass('bg-success');
        } else if (taskStatusValue === 'monitoring') {
            $('#registration-status').addClass('bg-info');
        } else {
            $('#registration-status').addClass('bg-secondary');
        }
    }

    // 更新状态文本，添加监控模式文本
    if ($('#registration-status').length) {
        let statusText = '已停止';
        if (taskStatusValue === 'running') {
            statusText = '正在运行';
        } else if (taskStatusValue === 'monitoring') {
            statusText = '监控模式';
        }
        $('#registration-status').text(statusText);
    }

    // 更新其他状态信息
    if ($('#last-run').length && taskStatus.registration_details?.last_run) {
        $('#last-run').text(new Date(taskStatus.registration_details.last_run).toLocaleString());
    }

    if ($('#last-status').length && taskStatus.registration_details?.last_status) {
        $('#last-status').text(taskStatus.registration_details.last_status);
    }

    if ($('#next-run').length && taskStatus.registration_details?.next_run) {
        // next_run是Unix时间戳，需要转换
        $('#next-run').text(new Date(taskStatus.registration_details.next_run * 1000).toLocaleString());
    }

    // 更新按钮状态 - 监控模式下也禁用启动按钮
    if ($('#start-registration').length && $('#stop-registration').length) {
        if (isRunning) {
            $('#start-registration').addClass('disabled').prop('disabled', true);
            $('#stop-registration').removeClass('disabled').prop('disabled', false);
        } else {
            $('#start-registration').removeClass('disabled').prop('disabled', false);
            $('#stop-registration').addClass('disabled').prop('disabled', true);
        }
    }

    // 更新统计信息
    const stats = taskStatus.registration_details?.statistics || {};

    if ($('#total-runs').length) {
        $('#total-runs').text(stats.total_runs || 0);
    }

    if ($('#successful-runs').length) {
        $('#successful-runs').text(stats.successful_runs || 0);
    }

    if ($('#failed-runs').length) {
        $('#failed-runs').text(stats.failed_runs || 0);
    }

    if ($('#success-rate').length) {
        $('#success-rate').text(stats.success_rate || '0%');
    }

    // 更新剩余槽位信息
    if ($('#remaining-slots').length) {
        $('#remaining-slots').text(taskStatus.remaining_slots || 0);
    }

    if ($('#current-count').length) {
        $('#current-count').text(taskStatus.active_count || taskStatus.current_count || 0);
    }

    if ($('#max-accounts').length) {
        $('#max-accounts').text(taskStatus.max_accounts || 0);
    }

    updateTaskStatusDisplay(data);

    // 添加状态消息显示
    if ($('#status-message').length) {
        if (taskStatus.status_message) {
            $('#status-message').text(taskStatus.status_message);
        } else {
            // 根据任务状态设置默认消息
            let defaultMessage = '任务未启动';
            if (taskStatusValue === 'running') {
                defaultMessage = '正在注册新账号...';
            } else if (taskStatusValue === 'monitoring') {
                defaultMessage = '已达到最大账号数量，正在监控账号数量变化...';
            } else if (taskStatus.registration_details?.last_status === 'completed') {
                defaultMessage = '任务已完成';
            } else if (taskStatus.registration_details?.last_status === 'error') {
                defaultMessage = '任务执行出错，请检查日志';
            }
            $('#status-message').text(defaultMessage);
        }
    }
}

// 渲染账号表格
function renderAccountsTable() {
    const accountsBody = $('#accounts-tbody');
    accountsBody.empty();

    console.log(`准备渲染账号表格，共${filteredAccounts.length}条数据`);

    if (filteredAccounts.length === 0) {
        // 添加空状态提示
        accountsBody.html(`
            <tr>
                <td colspan="7" class="text-center py-4">
                    <div class="py-5">
                        <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                        <p class="text-muted">暂无账号数据</p>
                    </div>
                </td>
            </tr>
        `);
        return;
    }

    // 计算当前页的数据
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredAccounts.length);
    const currentPageData = filteredAccounts.slice(startIndex, endIndex);

    console.log(`当前页数据: ${currentPageData.length}条 (第${currentPage}页)`);

    // 渲染每行数据
    currentPageData.forEach((account, index) => {
        console.log(`渲染账号: ${account.email}`);

        // 完整的行模板，包含所有单元格内容
        const row = `
            <tr id="account-row-${account.id}" data-status="${account.status}" 
                class="${account.status === 'deleted' ? 'table-danger' : account.status === 'disabled' ? 'table-warning' : ''}">
                <td class="d-none d-md-table-cell">${startIndex + index + 1}</td>
                <td class="email-column">
                    ${account.email}
                    <span class="badge ${account.status === 'active' ? 'bg-success' : account.status === 'disabled' ? 'bg-warning' : 'bg-danger'} ms-2">
                        ${account.status === 'active' ? '正常' : account.status === 'disabled' ? '停用' : '删除'}
                    </span>
                </td>
                <td class="d-none d-lg-table-cell password-cell">
                    <span class="password-text">${maskPassword(account.password)}</span>
                    <i class="fas fa-eye toggle-password" data-password="${account.password}" title="显示/隐藏密码"></i>
                    <i class="fas fa-copy copy-btn ms-1" data-copy="${account.password}" title="复制密码"></i>
                </td>
                ${renderTokenColumn(account.token, account.id)}
                ${renderUsageProgress(account.usage_limit)}
                <td class="d-none d-lg-table-cell">
                    ${account.created_at || '未知'}
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary get-usage-btn" data-email="${account.email}" title="查询使用量">
                        <i class="fas fa-chart-pie"></i>
                    </button>
                </td>
                <td class="operation-column">
                    <div class="d-flex flex-wrap gap-1">
                        ${account.status !== 'active' ?
                `<button class="btn btn-sm btn-outline-success status-action" data-email="${account.email}" data-id="${account.id}" data-status="active" title="设为正常">
                                <i class="fas fa-check-circle"></i>
                            </button>` : ''}
                            
                        ${account.status !== 'disabled' ?
                `<button class="btn btn-sm btn-outline-warning status-action" data-email="${account.email}" data-id="${account.id}" data-status="disabled" title="停用账号">
                                <i class="fas fa-pause-circle"></i>
                            </button>` : ''}
                            
                        ${account.status !== 'deleted' ?
                `<button class="btn btn-sm btn-outline-danger status-action" data-email="${account.email}" data-id="${account.id}" data-status="deleted" title="标记删除">
                                <i class="fas fa-times-circle"></i>
                            </button>` : ''}
                            
                        <button class="btn btn-sm btn-danger delete-account-btn" data-email="${account.email}" data-id="${account.id}" title="永久删除">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
        accountsBody.append(row);
    });

    // 绑定事件
    bindTableEvents();
    renderPagination();
}

// 渲染分页
function renderPagination() {
    const totalPages = Math.ceil(filteredAccounts.length / itemsPerPage);

    // 更新分页信息
    $('#total-accounts').text(filteredAccounts.length);

    // 计算当前页显示的起始和结束索引
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, filteredAccounts.length);

    // 更新页码信息
    $('#page-start').text(filteredAccounts.length > 0 ? startIndex : 0);
    $('#page-end').text(endIndex);

    // 清空并重新生成页码按钮
    const paginationUl = $('.pagination');

    // 保留第一个和最后一个元素（上一页和下一页按钮）
    const prevButton = $('#page-prev');
    const nextButton = $('#page-next');

    // 清空现有页码按钮（保留上一页和下一页按钮）
    paginationUl.find('li:not(#page-prev):not(#page-next)').remove();

    // 设置上一页和下一页按钮状态
    if (currentPage === 1) {
        prevButton.addClass('disabled');
        prevButton.find('a').attr('aria-disabled', 'true');
    } else {
        prevButton.removeClass('disabled');
        prevButton.find('a').attr('aria-disabled', 'false');
        prevButton.find('a').attr('data-page', currentPage - 1);
    }

    if (currentPage === totalPages || totalPages === 0) {
        nextButton.addClass('disabled');
        nextButton.find('a').attr('aria-disabled', 'true');
    } else {
        nextButton.removeClass('disabled');
        nextButton.find('a').attr('aria-disabled', 'false');
        nextButton.find('a').attr('data-page', currentPage + 1);
    }

    // 如果没有数据，不显示分页
    if (totalPages === 0) {
        return;
    }

    // 确定要显示的页码范围
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);

    // 调整startPage确保显示5个页码（如果可能）
    if (endPage - startPage < 4 && startPage > 1) {
        startPage = Math.max(1, endPage - 4);
    }

    // 插入新的页码按钮
    // 如果不是从第一页开始，添加第一页和省略号
    if (startPage > 1) {
        const firstPageItem = $(`<li class="page-item"><a class="page-link" href="#" data-page="1">1</a></li>`);
        prevButton.after(firstPageItem);

        if (startPage > 2) {
            const ellipsisItem = $(`<li class="page-item disabled"><span class="page-link">...</span></li>`);
            firstPageItem.after(ellipsisItem);
        }
    }

    // 添加中间的页码
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = $(`<li class="page-item ${i === currentPage ? 'active' : ''}"><a class="page-link" href="#" data-page="${i}">${i}</a></li>`);
        nextButton.before(pageItem);
    }

    // 如果不是到最后一页结束，添加省略号和最后一页
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsisItem = $(`<li class="page-item disabled"><span class="page-link">...</span></li>`);
            nextButton.before(ellipsisItem);
        }

        const lastPageItem = $(`<li class="page-item"><a class="page-link" href="#" data-page="${totalPages}">${totalPages}</a></li>`);
        nextButton.before(lastPageItem);
    }
}

// 更改页码
function changePage(page) {
    currentPage = page;
    renderAccountsTable();
}

// 过滤账号
function filterAccounts() {
    const searchTerm = $("#search-input").val().toLowerCase();
    if (!searchTerm) {
        filteredAccounts = [...accounts];
    } else {
        filteredAccounts = accounts.filter(account =>
            account.email.toLowerCase().includes(searchTerm) ||
            account.user.toLowerCase().includes(searchTerm)
        );
    }
    currentPage = 1;
    renderAccountsTable();
}

// 获取账号用量详情并更新数据库
function getAccountUsage(email) {
    showLoading();
    fetch(`/account/${encodeURIComponent(email)}/usage`)
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                // 创建并显示用量信息模态框
                const modal = $(`
                    <div class="modal fade" tabindex="-1">
                        <div class="modal-dialog">
                            <div class="modal-content">
                                <div class="modal-header">
                                    <h5 class="modal-title">账号用量信息</h5>
                                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                                <div class="modal-body">
                                    <div class="mb-3">
                                        <strong>邮箱:</strong> ${data.email}
                                    </div>
                                    <div class="mb-3">
                                        <strong>剩余额度:</strong> ${data.usage.remaining_balance !== null ? data.usage.remaining_balance : '未知'}
                                    </div>
                                    <div class="mb-3">
                                        <strong>剩余天数:</strong> ${data.usage.remaining_days !== null ? data.usage.remaining_days : '未知'}
                                    </div>
                                    <div class="mb-3">
                                        <strong>状态:</strong> 
                                        <span class="badge ${data.usage.status === 'active' ? 'bg-success' : 'bg-danger'}">
                                            ${data.usage.status === 'active' ? '活跃' : '不活跃'}
                                        </span>
                                    </div>
                                    <div class="mt-3 text-muted small">
                                        <strong>更新时间:</strong> ${formatDateTime(data.timestamp)}
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `);

                $('body').append(modal);
                const modalInstance = new bootstrap.Modal(modal[0]);
                modalInstance.show();

                // 模态框关闭时移除DOM
                modal[0].addEventListener('hidden.bs.modal', function () {
                    modal.remove();
                });
            }
        })
        .catch(error => {
            console.error('获取账号用量失败:', error);
            showAlert('获取账号用量失败', 'danger');
            hideLoading();
        });
}

// 更新账号用量到数据库
function updateAccountUsageLimit(email, usageLimit) {
    fetch(`/account/${encodeURIComponent(email)}/update-usage`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usage_limit: usageLimit })
    })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log(`账号 ${email} 用量数据已更新到数据库`);
            } else {
                console.error(`更新账号 ${email} 用量数据失败:`, data.message);
            }
        })
        .catch(error => {
            console.error(`更新账号 ${email} 用量数据时发生错误:`, error);
        });
}

// 修复任务状态更新问题
function startTaskManually() {
    showLoading();
    fetch('/registration/start', {
        method: 'GET'
    })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                showAlert('定时任务已成功启动', 'success');

                // 立即更新任务状态 - 添加这段代码
                fetch('/registration/status')
                    .then(res => res.json())
                    .then(statusData => {
                        updateTaskStatusUI(statusData);
                    });
            } else {
                showAlert(`启动任务失败: ${data.message || '未知错误'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('启动任务时发生错误:', error);
            hideLoading();
            showAlert('启动任务失败，请稍后重试', 'danger');
        });
}

// 同样添加到停止任务函数
function stopTaskManually() {
    showLoading();
    fetch('/registration/stop', {
        method: 'GET'
    })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                showAlert('定时任务已成功停止', 'success');

                // 立即更新任务状态 - 添加这段代码
                fetch('/registration/status')
                    .then(res => res.json())
                    .then(statusData => {
                        updateTaskStatusUI(statusData);
                    });
            } else {
                showAlert(`停止任务失败: ${data.message || '未知错误'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('停止任务时发生错误:', error);
            hideLoading();
            showAlert('停止任务失败，请稍后重试', 'danger');
        });
}

// 复制到剪贴板
function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showAlert('复制成功，Token已复制到剪贴板', 'success');
    }).catch(err => {
        console.error('复制失败:', err);
        showAlert('复制失败', 'danger');
    });
}

// 显示通知
function showAlert(message, type, isSpecial = false) {
    const alertId = 'alert-' + Date.now();
    const alertClass = isSpecial ?
        `alert-${type} special-alert animate__animated animate__bounceIn` :
        `alert-${type} animate__animated animate__fadeInRight`;

    const alert = $(`
        <div id="${alertId}" class="alert ${alertClass} alert-dismissible fade show" role="alert">
            ${isSpecial ? '<i class="fas fa-star me-2"></i>' : ''}${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `);

    $("#alert-container").append(alert);

    // 5秒后自动消失
    setTimeout(() => {
        $(`#${alertId}`).alert('close');
    }, 5000);
}

// 日期时间格式化
function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '-';

    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) return dateTimeString;

        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');

        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
        return dateTimeString;
    }
}

// 修改掩码函数，增加对用户名的特殊处理
function maskText(text, showChars = 6, isUsername = false) {
    if (!text) return '';

    // 用户名特殊处理 - 只显示前1/3
    if (isUsername) {
        const showLength = Math.ceil(text.length / 3);
        if (text.length <= showLength) return text;
        return `${text.substring(0, showLength)}...`;
    }

    // 其他文本使用标准处理
    if (text.length <= showChars) return text;
    return `${text.substring(0, showChars)}...`;
}

// 隐藏密码
function maskPassword(password) {
    if (!password) return '';
    return '•'.repeat(password.length);
}

// 页面加载动画
document.addEventListener('DOMContentLoaded', function () {
    // 修改动画类添加代码，删除对已删除元素的引用
    const elements = [
        { selector: '.card', animation: 'animate__fadeIn', delay: 0.2 }
    ];

    elements.forEach(item => {
        const elems = document.querySelectorAll(item.selector);
        elems.forEach((el, index) => {
            el.classList.add('animate__animated', item.animation);

            if (item.delay) {
                const delay = item.stagger ? item.delay * (index + 1) : item.delay;
                el.style.animationDelay = `${delay}s`;
            }
        });
    });
});

// 烟花动画实现
const Fireworks = {
    canvas: null,
    ctx: null,
    particles: [],

    init: function () {
        this.canvas = document.getElementById('fireworks-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    },

    resizeCanvas: function () {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    start: function () {
        this.canvas.style.display = 'block';
        this.particles = [];

        // 创建5次烟花，间隔300ms
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height * 0.6;
                this.createParticles(x, y);
            }, i * 300);
        }

        this.animate();

        // 5秒后停止动画
        setTimeout(() => {
            this.canvas.style.display = 'none';
        }, 5000);
    },

    createParticles: function (x, y) {
        const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'];

        for (let i = 0; i < 80; i++) {
            const particle = {
                x: x,
                y: y,
                size: Math.random() * 4 + 1,
                color: colors[Math.floor(Math.random() * colors.length)],
                velocity: {
                    x: (Math.random() - 0.5) * 8,
                    y: (Math.random() - 0.5) * 8
                },
                alpha: 1,
                decay: Math.random() * 0.02 + 0.01
            };

            this.particles.push(particle);
        }
    },

    animate: function () {
        if (this.particles.length === 0) return;

        requestAnimationFrame(() => this.animate());

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < this.particles.length; i++) {
            const p = this.particles[i];

            // 添加重力
            p.velocity.y += 0.05;

            // 更新位置
            p.x += p.velocity.x;
            p.y += p.velocity.y;

            // 减少透明度
            p.alpha -= p.decay;

            // 绘制粒子
            this.ctx.save();
            this.ctx.globalAlpha = p.alpha;
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();

            // 移除消失的粒子
            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
                i--;
            }
        }
    }
};

// 初始化烟花
Fireworks.init();

// 绑定表格交互事件
function bindTableEvents() {
    // 显示/隐藏用户名
    $('.toggle-username').off('click').on('click', function () {
        const username = $(this).data('username');
        const usernameText = $(this).prev('.username-text');

        if (usernameText.text() === username) {
            usernameText.text(maskText(username, 6, true));
        } else {
            usernameText.text(username);
        }
    });

    // 显示/隐藏密码
    $('.toggle-password').off('click').on('click', function () {
        const password = $(this).data('password');
        const passwordText = $(this).prev('.password-text');

        if (passwordText.text() === password) {
            passwordText.text(maskPassword(password));
        } else {
            passwordText.text(password);
        }
    });

    // 显示/隐藏Token
    $('.toggle-token').off('click').on('click', function () {
        const token = $(this).data('token');
        const tokenText = $(this).prev('.token-text');

        if (tokenText.text() === token) {
            tokenText.text(maskText(token));
        } else {
            tokenText.text(token);
        }
    });

    // 复制按钮
    $('.copy-btn').off('click').on('click', function () {
        const textToCopy = $('#tokenFullText').val();
        copyToClipboard(textToCopy);
    });

    // 获取用量按钮
    $('.get-usage-btn').off('click').on('click', function () {
        const email = $(this).data('email');
        getAccountUsage(email);
    });

    // 删除按钮
    $('.delete-account-btn').off('click').on('click', function () {
        const email = $(this).data('email');
        const id = $(this).data('id');
        $('#deleteEmailConfirm').text(email);
        $('#deleteIdConfirm').text(id || '无');

        // 重置并重新绑定确认删除按钮事件
        $('#confirmDeleteBtn').off('click').on('click', function () {
            deleteAccount(email, id, true);
        });

        const deleteModal = new bootstrap.Modal(document.getElementById('deleteConfirmModal'));
        deleteModal.show();
    });

    // 状态操作按钮
    $('.status-action').off('click').on('click', function (e) {
        e.preventDefault();
        const email = $(this).data('email');
        const id = $(this).data('id');
        const status = $(this).data('status');
        updateAccountStatus(email, id, status);
    });

    // 查看Token按钮
    $('.view-token-btn').off('click').on('click', function () {
        const token = $(this).data('token');
        const accountId = $(this).data('account-id');
        $('#tokenFullText').val(token);
        $('#useTokenBtn').data('account-id', accountId);
        new bootstrap.Modal(document.getElementById('tokenViewModal')).show();
    });

    // 使用Token按钮
    $('#useTokenBtn').off('click').on('click', function () {
        const accountId = $(this).data('account-id');
        if (!accountId) {
            showAlert('账号ID无效', 'danger');
            return;
        }

        showLoading();
        fetch(`/account/use-token/${accountId}`, {
            method: 'POST'
        })
            .then(res => res.json())
            .then(data => {
                hideLoading();
                if (data.success) {
                    showAlert(data.message, 'success');
                    $('#tokenViewModal').modal('hide');
                } else {
                    showAlert(`使用Token失败: ${data.message || '未知错误'}`, 'danger');
                }
            })
            .catch(error => {
                console.error('使用Token时发生错误:', error);
                hideLoading();
                showAlert('使用Token失败，请稍后重试', 'danger');
            });
    });
}

// 更新删除确认按钮事件处理
$('#confirmDeleteBtn').click(function () {
    const email = $(this).data('email');
    const id = $(this).data('id');
    deleteAccount(email, id, true);
});

// 修改updateAccountStatus函数，确保正确发送请求体
function updateAccountStatus(email, id, status) {
    showLoading();
    // 优先使用ID API，如果ID存在的话
    const apiUrl = id ?
        `/account/id/${id}/status` :
        `/account/${encodeURIComponent(email)}/status`;

    fetch(apiUrl, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: status })  // 确保这里的字段名是status
    })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                let statusText = '';
                if (status === 'active') statusText = '正常';
                else if (status === 'disabled') statusText = '停用';
                else if (status === 'deleted') statusText = '删除';

                showAlert(`账号${id ? '(ID:' + id + ')' : ''} ${email} 已成功设置为${statusText}状态`, 'success');
                loadAllData();
            } else {
                showAlert(`更新账号状态失败: ${data.message || '未知错误'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('更新账号状态时发生错误:', error);
            hideLoading();
            showAlert('更新账号状态失败，请稍后重试', 'danger');
        });
}

// 修改deleteAccount函数，支持通过ID删除
function deleteAccount(email, id, hardDelete = true) {
    showLoading();
    // 优先使用ID API，如果ID存在的话
    const apiUrl = id ?
        `/account/id/${id}${hardDelete ? '?hard_delete=true' : ''}` :
        `/account/${encodeURIComponent(email)}${hardDelete ? '?hard_delete=true' : ''}`;

    fetch(apiUrl, {
        method: 'DELETE'
    })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                showAlert(`账号${id ? '(ID:' + id + ')' : ''} ${email} 已成功删除`, 'success');
                // 关闭模态框
                $('#deleteConfirmModal').modal('hide');
                // 重新加载账号列表
                loadAllData();
            } else {
                showAlert(`删除账号失败: ${data.message || '未知错误'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('删除账号时发生错误:', error);
            hideLoading();
            showAlert('删除账号失败，请稍后重试', 'danger');
        });
}

// 添加强制刷新函数
function forceRefreshData() {
    window.forceRefresh = true;
    loadAllData();
}

// 完全重构额度显示函数，精确匹配参考代码
function renderUsageProgress(usageLimit) {
    // 计算使用进度
    const premiumUsed = 150 - usageLimit;
    const premiumTotal = 150;
    const premiumRemaining = premiumTotal - premiumUsed;
    const premiumPercent = Math.round((premiumUsed / premiumTotal) * 100);

    return `
        <td class="usage-info">
            <div class="usage-numbers">
                <span class="used-count">${premiumUsed}</span>
                <span class="separator">/</span>
                <span class="total-count">${premiumTotal}</span>
                <span class="remaining-count">(剩余: ${premiumRemaining})</span>
            </div>
            <div class="battery-progress" data-percent="${Math.round(premiumPercent / 10) * 10}">
                <div class="battery-bars">
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                    <span class="battery-bar"></span>
                </div>
                <span class="battery-percent">${premiumPercent}%</span>
            </div>
        </td>
    `;
}

// 修改Token列的渲染方式
function renderTokenColumn(token, accountId) {
    return `
        <td class="token-column">
            <button class="btn btn-sm btn-outline-info view-token-btn" data-token="${token}" data-account-id="${accountId}">
                <i class="fas fa-eye"></i> 查看Token
            </button>
        </td>
    `;
}

// 加载配置函数
function loadConfig() {
    showLoading();
    fetch('/config')
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                const config = data.data;
                $("#browser-headless").val(config.BROWSER_HEADLESS.toString());
                $("#dynamic-useragent").prop('checked', config.DYNAMIC_USERAGENT || false);

                // 触发动态UA的change事件
                $("#dynamic-useragent").trigger('change');

                $("#browser-useragent").val(config.BROWSER_USER_AGENT);
                $("#accounts-limit").val(config.MAX_ACCOUNTS);
                $("#email-domains").val(config.EMAIL_DOMAINS);
                $("#email-username").val(config.EMAIL_USERNAME);
                $("#email-pin").val(config.EMAIL_PIN);
                $("#browser-path").val(config.BROWSER_PATH || '');
                $("#cursor-path").val(config.CURSOR_PATH || '');
            } else {
                showAlert(`加载配置失败: ${data.message || '未知错误'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('加载配置时发生错误:', error);
            hideLoading();
            showAlert('加载配置失败，请稍后重试', 'danger');
        });
}

// 保存配置函数
function saveConfig() {
    showLoading();
    const isDynamicUA = $("#dynamic-useragent").prop('checked');

    const config = {
        BROWSER_HEADLESS: $("#browser-headless").val() === 'true',
        DYNAMIC_USERAGENT: isDynamicUA,
        BROWSER_USER_AGENT: isDynamicUA ? "" : $("#browser-useragent").val(),
        MAX_ACCOUNTS: parseInt($("#accounts-limit").val()),
        EMAIL_DOMAINS: $("#email-domains").val(),
        EMAIL_USERNAME: $("#email-username").val(),
        EMAIL_PIN: $("#email-pin").val(),
        BROWSER_PATH: $("#browser-path").val(),
        CURSOR_PATH: $("#cursor-path").val()
    };

    fetch('/config', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(config)
    })
        .then(res => res.json())
        .then(data => {
            hideLoading();
            if (data.success) {
                showAlert('配置已成功保存', 'success');
                enableConfigForm(false); // 禁用编辑状态
            } else {
                showAlert(`保存配置失败: ${data.message || '未知错误'}`, 'danger');
            }
        })
        .catch(error => {
            console.error('保存配置时发生错误:', error);
            hideLoading();
            showAlert('保存配置失败，请稍后重试', 'danger');
        });
}

// 启用/禁用配置表单
function enableConfigForm(enable) {
    const inputs = $('#config-form select, #config-form input');
    if (enable) {
        inputs.prop('disabled', false);
        // 如果动态UA已启用，保持UA输入框禁用
        if ($("#dynamic-useragent").prop('checked')) {
            $("#browser-useragent").prop('disabled', true);
        }
        // 显示按钮容器而不是单个按钮
        $('#config-actions').show();
        $('#edit-config-btn').hide();
    } else {
        inputs.prop('disabled', true);
        // 隐藏按钮容器
        $('#config-actions').hide();
        $('#edit-config-btn').show();
    }
}

// 动态User-Agent切换逻辑
$("#dynamic-useragent").change(function () {
    const isDynamicUA = $(this).prop('checked');
    if (isDynamicUA) {
        $("#browser-useragent").prop('disabled', true);
        $("#useragent-input-container").addClass('text-muted');
    } else {
        // 只有在编辑模式下才启用输入框
        const isEditMode = !$("#edit-config-btn").is(":visible");
        $("#browser-useragent").prop('disabled', !isEditMode);
        $("#useragent-input-container").removeClass('text-muted');
    }
});

// 修改任务状态显示函数，删除与暂停/恢复相关逻辑
function updateTaskStatusDisplay(statusData) {
    // 更新状态徽章
    const statusBadge = $("#registration-status");
    const taskStatusText = $("#task-status-text");
    const taskIcon = $("#task-status i");

    // 更新账号使用情况
    $("#current-count").text(statusData.current_count);
    $("#max-accounts").text(statusData.max_accounts);
    $("#remaining-slots").text(`剩余: ${statusData.remaining_slots}`);

    // 计算使用百分比并更新电池进度条
    const usagePercent = Math.floor((statusData.current_count / statusData.max_accounts) * 100);
    $(".battery-progress").attr("data-percent", usagePercent);
    $(".battery-percent").text(`${usagePercent}%`);

    // 更新任务详情
    if (statusData.registration_details) {
        const details = statusData.registration_details;

        // 更新统计信息
        if (details.statistics) {
            $("#total-runs").text(details.statistics.total_runs);
            $("#successful-runs").text(details.statistics.successful_runs);
            $("#failed-runs").text(details.statistics.failed_runs);
            $("#success-rate").text(details.statistics.success_rate);
        }
    }

    console.log('task_status=>', statusData.task_status)
    // 根据任务状态更新UI，删除暂停状态处理
    switch (statusData.task_status) {
        case "running":
            statusBadge.removeClass("bg-success bg-warning bg-danger").addClass("bg-primary");
            statusBadge.text("运行中");
            taskStatusText.text("任务正在运行中");
            taskIcon.removeClass("fa-check-circle fa-pause-circle fa-times-circle").addClass("fa-spinner fa-spin");
            taskIcon.removeClass("text-success text-warning text-danger").addClass("text-primary");

            // 只保留隐藏开始按钮和显示停止按钮的逻辑
            $("#start-registration").hide();
            $("#stop-registration").show();
            break;

        case "stopped":
        default:
            statusBadge.removeClass("bg-primary bg-warning bg-danger").addClass("bg-success");
            statusBadge.text("空闲中");
            taskStatusText.text(statusData.status_message || "系统空闲中，可以开始新任务");
            taskIcon.removeClass("fa-spinner fa-spin fa-pause-circle fa-times-circle").addClass("fa-check-circle");
            taskIcon.removeClass("text-primary text-warning text-danger").addClass("text-success");

            // 只保留显示开始按钮和隐藏停止按钮的逻辑
            $("#start-registration").show();
            $("#stop-registration").hide();
            break;
    }

    // 处理显示/隐藏注册详情面板
    if (statusData.task_status === "running") {
        $("#registration-details").show();
    } else {
        $("#registration-details").hide();
    }
}
