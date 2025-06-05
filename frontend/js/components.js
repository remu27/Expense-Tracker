// UI 컴포넌트 클래스
class Components {
    // 토스트 알림 표시
    static showToast(message, type = 'success') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }

    // 로딩 표시/숨김
    static showLoading() {
        document.getElementById('loading').classList.remove('hidden');
    }

    static hideLoading() {
        document.getElementById('loading').classList.add('hidden');
    }

    // 모달 표시
    static showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.add('show');
        modal.style.display = 'flex';
    }

    // 모달 숨김
    static hideModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
        modal.style.display = 'none';
    }

    // 지출 아이템 렌더링
    static renderExpenseItem(expense) {
        return `
            <div class="expense-item" data-id="${expense.id}">
                <div class="expense-info">
                    <div class="expense-title">${expense.description || '지출'}</div>
                    <div class="expense-details">
                        ${expense.category} • ${Utils.formatDate(expense.date)}
                    </div>
                </div>
                <div class="expense-amount">${Utils.formatCurrency(expense.amount)}</div>
                <div class="expense-actions">
                    <button class="btn-icon edit" onclick="editExpense('${expense.id}')" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteExpense('${expense.id}')" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // 카테고리 아이템 렌더링
    static renderCategoryItem(category) {
        return `
            <div class="category-item" data-id="${category.id}">
                <div class="category-info">
                    <div class="category-color" style="background-color: ${category.color}"></div>
                    <div class="category-name">${category.name}</div>
                </div>
                <div class="category-actions">
                    <button class="btn-icon edit" onclick="editCategory('${category.id}')" title="수정">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-icon delete" onclick="deleteCategory('${category.id}')" title="삭제">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    // 예산 상태 아이템 렌더링
    static renderBudgetStatusItem(budget) {
        const percentage = Utils.calculatePercentage(budget.spent_amount, budget.budget_amount);
        let statusClass = 'safe';
        if (percentage >= 100) statusClass = 'danger';
        else if (percentage >= 80) statusClass = 'warning';

        return `
            <div class="budget-status-item">
                <div class="budget-header">
                    <div class="budget-category">${budget.category}</div>
                    <div class="budget-percentage ${statusClass}">${percentage}%</div>
                </div>
                <div class="budget-progress">
                    <div class="budget-progress-bar ${statusClass}" 
                         style="width: ${Math.min(percentage, 100)}%"></div>
                </div>
                <div class="budget-amounts">
                    <span>사용: ${Utils.formatCurrency(budget.spent_amount)}</span>
                    <span>예산: ${Utils.formatCurrency(budget.budget_amount)}</span>
                </div>
            </div>
        `;
    }

    // 빈 상태 렌더링
    static renderEmptyState(icon, title, description, actionText, actionCallback) {
        return `
            <div class="empty-state">
                <i class="fas ${icon}"></i>
                <h3>${title}</h3>
                <p>${description}</p>
                ${actionText ? `<button class="btn btn-primary" onclick="${actionCallback}">${actionText}</button>` : ''}
            </div>
        `;
    }

    // 카테고리 옵션 렌더링
    static renderCategoryOptions(categories, selectedValue = '') {
        return categories.map(category => 
            `<option value="${category.name}" ${category.name === selectedValue ? 'selected' : ''}>
                ${category.name}
            </option>`
        ).join('');
    }

    // 차트 생성
    static createChart(ctx, type, data, options = {}) {
        return new Chart(ctx, {
            type,
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                ...options
            }
        });
    }

    // 카테고리별 차트 데이터 생성
    static createCategoryChartData(categoryData) {
        const colors = [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
        ];

        return {
            labels: categoryData.map(item => item.category),
            datasets: [{
                data: categoryData.map(item => item.total_amount),
                backgroundColor: colors.slice(0, categoryData.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
    }

    // 월별 차트 데이터 생성
    static createMonthlyChartData(monthlyData) {
        return {
            labels: monthlyData.map(item => item.month),
            datasets: [{
                label: '월별 지출',
                data: monthlyData.map(item => item.total_amount),
                borderColor: '#3B82F6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        };
    }
}

// 전역 컴포넌트 클래스
window.Components = Components;
