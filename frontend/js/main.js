// 메인 애플리케이션 클래스
class ExpenseTracker {
    constructor() {
        this.currentTab = 'dashboard';
        this.categories = [];
        this.expenses = [];
        this.budgets = [];
        this.charts = {};
        this.editingExpense = null;
        this.editingBudget = null;
        this.editingCategory = null;

        this.init();
    }

    // 초기화
    async init() {
        this.setupEventListeners();
        this.setupFormDefaults();
        await this.loadInitialData();
        this.updateDashboard();
    }

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 탭 네비게이션
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.target.closest('.nav-btn').dataset.tab;
                this.showTab(tab);
            });
        });

        // 모달 외부 클릭 시 닫기
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    Components.hideModal(modal.id);
                }
            });
        });

        // 폼 제출 이벤트
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExpense();
        });

        document.getElementById('budget-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveBudget();
        });

        document.getElementById('category-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCategory();
        });

        // 색상 선택기 이벤트
        document.getElementById('category-color').addEventListener('change', (e) => {
            document.getElementById('color-preview').style.backgroundColor = e.target.value;
        });

        // 차트 기간 변경
        document.getElementById('chart-period').addEventListener('change', () => {
            this.updateCategoryChart();
        });
    }

    // 폼 기본값 설정
    setupFormDefaults() {
        const currentDate = Utils.getCurrentDate();
        document.getElementById('expense-date').value = currentDate.dateString;
        document.getElementById('budget-year').value = currentDate.year;
        document.getElementById('budget-month').value = currentDate.month;
    }

    // 초기 데이터 로드
    async loadInitialData() {
        try {
            Components.showLoading();
            
            // 병렬로 데이터 로드
            const [categories, expenses, budgets] = await Promise.all([
                api.categories.getAll(),
                api.expenses.getAll({ limit: 100 }),
                api.budgets.getAll()
            ]);

            this.categories = categories;
            this.expenses = expenses;
            this.budgets = budgets;

            this.updateCategorySelects();
            
        } catch (error) {
            console.error('Failed to load initial data:', error);
            Components.showToast('데이터 로드에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 탭 표시
    showTab(tabName) {
        // 모든 탭 숨기기
        document.querySelectorAll('.tab-content').forEach(tab => {
            tab.classList.remove('active');
        });

        // 모든 네비게이션 버튼 비활성화
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // 선택된 탭 표시
        document.getElementById(tabName).classList.add('active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        this.currentTab = tabName;

        // 탭별 데이터 로드
        switch (tabName) {
            case 'dashboard':
                this.updateDashboard();
                break;
            case 'expenses':
                this.loadExpenses();
                break;
            case 'budgets':
                this.loadBudgets();
                break;
            case 'categories':
                this.loadCategories();
                break;
        }
    }

    // 대시보드 업데이트
    async updateDashboard() {
        try {
            const currentDate = Utils.getCurrentDate();
            const monthRange = Utils.getCurrentMonthRange();

            // 이번 달 지출 조회
            const monthlyExpenses = await api.expenses.getAll({
                start_date: monthRange.start,
                end_date: monthRange.end
            });

            // 이번 달 예산 조회
            const monthlyBudgets = await api.budgets.getAll({
                period: 'monthly',
                year: currentDate.year,
                month: currentDate.month
            });

            // 요약 데이터 계산
            const totalExpense = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const totalBudget = monthlyBudgets.reduce((sum, budget) => sum + budget.amount, 0);
            const remainingBudget = totalBudget - totalExpense;

            // UI 업데이트
            document.getElementById('monthly-expense').textContent = Utils.formatCurrency(totalExpense);
            document.getElementById('monthly-budget').textContent = Utils.formatCurrency(totalBudget);
            document.getElementById('remaining-budget').textContent = Utils.formatCurrency(remainingBudget);

            // 예산 진행률
            const budgetProgress = totalBudget > 0 ? (totalExpense / totalBudget) * 100 : 0;
            document.getElementById('budget-progress').style.width = `${Math.min(budgetProgress, 100)}%`;

            // 남은 일수
            const daysLeft = Utils.getDaysLeftInMonth();
            document.getElementById('days-left').textContent = `이번 달 ${daysLeft}일 남음`;

            // 차트 업데이트
            await this.updateCharts();

            // 최근 지출 업데이트
            this.updateRecentExpenses();

        } catch (error) {
            console.error('Failed to update dashboard:', error);
            Components.showToast('대시보드 업데이트에 실패했습니다.', 'error');
        }
    }

    // 차트 업데이트
    async updateCharts() {
        await Promise.all([
            this.updateCategoryChart(),
            this.updateMonthlyChart()
        ]);
    }

    // 카테고리별 차트 업데이트
    async updateCategoryChart() {
        try {
            const period = document.getElementById('chart-period').value;
            const currentDate = Utils.getCurrentDate();
            
            let params = {};
            if (period === 'month') {
                params = { year: currentDate.year, month: currentDate.month };
            } else {
                params = { year: currentDate.year };
            }

            const categoryData = await api.expenses.getCategorySummary(params);

            const ctx = document.getElementById('categoryChart').getContext('2d');
            
            // 기존 차트 제거
            if (this.charts.category) {
                this.charts.category.destroy();
            }

            if (categoryData.length > 0) {
                const chartData = Components.createCategoryChartData(categoryData);
                this.charts.category = Components.createChart(ctx, 'doughnut', chartData);
            } else {
                // 데이터가 없을 때
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText('데이터가 없습니다', ctx.canvas.width / 2, ctx.canvas.height / 2);
            }

        } catch (error) {
            console.error('Failed to update category chart:', error);
        }
    }

    // 월별 차트 업데이트
    async updateMonthlyChart() {
        try {
            const currentDate = Utils.getCurrentDate();
            const monthlyData = await api.expenses.getMonthlySummary({ year: currentDate.year });

            const ctx = document.getElementById('monthlyChart').getContext('2d');
            
            // 기존 차트 제거
            if (this.charts.monthly) {
                this.charts.monthly.destroy();
            }

            if (monthlyData.length > 0) {
                const chartData = Components.createMonthlyChartData(monthlyData);
                this.charts.monthly = Components.createChart(ctx, 'line', chartData);
            } else {
                // 데이터가 없을 때
                ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                ctx.font = '16px Arial';
                ctx.fillStyle = '#64748b';
                ctx.textAlign = 'center';
                ctx.fillText('데이터가 없습니다', ctx.canvas.width / 2, ctx.canvas.height / 2);
            }

        } catch (error) {
            console.error('Failed to update monthly chart:', error);
        }
    }

    // 최근 지출 업데이트
    updateRecentExpenses() {
        const recentExpenses = this.expenses.slice(0, 5);
        const container = document.getElementById('recent-expenses-list');

        if (recentExpenses.length === 0) {
            container.innerHTML = Components.renderEmptyState(
                'fa-receipt',
                '지출 내역이 없습니다',
                '첫 번째 지출을 추가해보세요.',
                '지출 추가',
                'showExpenseModal()'
            );
        } else {
            container.innerHTML = recentExpenses
                .map(expense => Components.renderExpenseItem(expense))
                .join('');
        }
    }

    // 지출 목록 로드
    async loadExpenses() {
        try {
            Components.showLoading();
            
            const expenses = await api.expenses.getAll({ limit: 100 });
            this.expenses = expenses;

            const container = document.getElementById('expenses-list');
            
            if (expenses.length === 0) {
                container.innerHTML = Components.renderEmptyState(
                    'fa-receipt',
                    '지출 내역이 없습니다',
                    '첫 번째 지출을 추가해보세요.',
                    '지출 추가',
                    'showExpenseModal()'
                );
            } else {
                container.innerHTML = expenses
                    .map(expense => Components.renderExpenseItem(expense))
                    .join('');
            }

        } catch (error) {
            console.error('Failed to load expenses:', error);
            Components.showToast('지출 목록 로드에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 예산 목록 로드
    async loadBudgets() {
        try {
            Components.showLoading();

            const currentDate = Utils.getCurrentDate();
            
            // 예산 현황과 목록을 병렬로 로드
            const [budgetStatus, budgets] = await Promise.all([
                api.budgets.getStatus({ year: currentDate.year, month: currentDate.month }),
                api.budgets.getAll()
            ]);

            // 예산 현황 표시
            const statusContainer = document.getElementById('budget-status');
            if (budgetStatus.budget_status.length > 0) {
                statusContainer.innerHTML = budgetStatus.budget_status
                    .map(budget => Components.renderBudgetStatusItem(budget))
                    .join('');
            } else {
                statusContainer.innerHTML = Components.renderEmptyState(
                    'fa-piggy-bank',
                    '설정된 예산이 없습니다',
                    '예산을 설정하여 지출을 관리해보세요.',
                    '예산 설정',
                    'showBudgetModal()'
                );
            }

            // 예산 목록 표시
            const listContainer = document.getElementById('budgets-list');
            if (budgets.length === 0) {
                listContainer.innerHTML = '<p class="text-center text-gray-500">설정된 예산이 없습니다.</p>';
            } else {
                listContainer.innerHTML = this.renderBudgetList(budgets);
            }

        } catch (error) {
            console.error('Failed to load budgets:', error);
            Components.showToast('예산 정보 로드에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 예산 목록 렌더링
    renderBudgetList(budgets) {
        return `
            <div class="table-responsive">
                <table class="table">
                    <thead>
                        <tr>
                            <th>카테고리</th>
                            <th>금액</th>
                            <th>기간</th>
                            <th>연도</th>
                            <th>월</th>
                            <th>작업</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${budgets.map(budget => `
                            <tr>
                                <td>${budget.category}</td>
                                <td>${Utils.formatCurrency(budget.amount)}</td>
                                <td>${budget.period === 'monthly' ? '월별' : '연별'}</td>
                                <td>${budget.year}</td>
                                <td>${budget.month || '-'}</td>
                                <td>
                                    <button class="btn-icon edit" onclick="editBudget('${budget.id}')" title="수정">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn-icon delete" onclick="deleteBudget('${budget.id}')" title="삭제">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 카테고리 목록 로드
    async loadCategories() {
        try {
            Components.showLoading();

            const categories = await api.categories.getAll();
            this.categories = categories;

            const container = document.getElementById('categories-list');
            
            if (categories.length === 0) {
                container.innerHTML = Components.renderEmptyState(
                    'fa-tags',
                    '카테고리가 없습니다',
                    '기본 카테고리를 추가하거나 새로운 카테고리를 만들어보세요.',
                    '기본 카테고리 추가',
                    'initializeCategories()'
                );
            } else {
                container.innerHTML = categories
                    .map(category => Components.renderCategoryItem(category))
                    .join('');
            }

            this.updateCategorySelects();

        } catch (error) {
            console.error('Failed to load categories:', error);
            Components.showToast('카테고리 로드에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 카테고리 선택 옵션 업데이트
    updateCategorySelects() {
        const selects = [
            'expense-category',
            'budget-category',
            'expense-filter-category'
        ];

        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const currentValue = select.value;
                select.innerHTML = selectId === 'expense-filter-category' 
                    ? '<option value="">전체</option>' + Components.renderCategoryOptions(this.categories)
                    : Components.renderCategoryOptions(this.categories);
                select.value = currentValue;
            }
        });
    }

    // 지출 모달 표시
    showExpenseModal(expenseId = null) {
        this.editingExpense = expenseId;
        
        if (expenseId) {
            // 수정 모드
            const expense = this.expenses.find(e => e.id === expenseId);
            if (expense) {
                document.getElementById('expense-modal-title').textContent = '지출 수정';
                document.getElementById('expense-amount').value = expense.amount;
                document.getElementById('expense-category').value = expense.category;
                document.getElementById('expense-date').value = expense.date;
                document.getElementById('expense-description').value = expense.description || '';
            }
        } else {
            // 추가 모드
            document.getElementById('expense-modal-title').textContent = '지출 추가';
            document.getElementById('expense-form').reset();
            document.getElementById('expense-date').value = Utils.getCurrentDate().dateString;
        }

        Components.showModal('expense-modal');
    }

    // 지출 저장
    async saveExpense() {
        try {
            const formData = {
                amount: parseFloat(document.getElementById('expense-amount').value),
                category: document.getElementById('expense-category').value,
                date: document.getElementById('expense-date').value,
                description: document.getElementById('expense-description').value || null
            };

            Components.showLoading();

            if (this.editingExpense) {
                // 수정
                await api.expenses.update(this.editingExpense, formData);
                Components.showToast('지출이 수정되었습니다.');
            } else {
                // 추가
                await api.expenses.create(formData);
                Components.showToast('지출이 추가되었습니다.');
            }

            Components.hideModal('expense-modal');
            
            // 데이터 새로고침
            await this.loadInitialData();
            if (this.currentTab === 'expenses') {
                this.loadExpenses();
            } else if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }

        } catch (error) {
            console.error('Failed to save expense:', error);
            Components.showToast('지출 저장에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 지출 삭제
    async deleteExpense(expenseId) {
        if (!confirm('이 지출을 삭제하시겠습니까?')) {
            return;
        }

        try {
            Components.showLoading();
            await api.expenses.delete(expenseId);
            Components.showToast('지출이 삭제되었습니다.');
            
            // 데이터 새로고침
            await this.loadInitialData();
            if (this.currentTab === 'expenses') {
                this.loadExpenses();
            } else if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }

        } catch (error) {
            console.error('Failed to delete expense:', error);
            Components.showToast('지출 삭제에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 예산 모달 표시
    showBudgetModal(budgetId = null) {
        this.editingBudget = budgetId;
        
        if (budgetId) {
            // 수정 모드
            const budget = this.budgets.find(b => b.id === budgetId);
            if (budget) {
                document.getElementById('budget-modal-title').textContent = '예산 수정';
                document.getElementById('budget-category').value = budget.category;
                document.getElementById('budget-amount').value = budget.amount;
                document.getElementById('budget-period').value = budget.period;
                document.getElementById('budget-year').value = budget.year;
                document.getElementById('budget-month').value = budget.month || '';
                this.toggleMonthField();
            }
        } else {
            // 추가 모드
            document.getElementById('budget-modal-title').textContent = '예산 설정';
            document.getElementById('budget-form').reset();
            const currentDate = Utils.getCurrentDate();
            document.getElementById('budget-year').value = currentDate.year;
            document.getElementById('budget-month').value = currentDate.month;
            this.toggleMonthField();
        }

        Components.showModal('budget-modal');
    }

    // 월 필드 토글
    toggleMonthField() {
        const period = document.getElementById('budget-period').value;
        const monthField = document.getElementById('month-field');
        
        if (period === 'monthly') {
            monthField.style.display = 'block';
            document.getElementById('budget-month').required = true;
        } else {
            monthField.style.display = 'none';
            document.getElementById('budget-month').required = false;
        }
    }

    // 예산 저장
    async saveBudget() {
        try {
            const period = document.getElementById('budget-period').value;
            const formData = {
                category: document.getElementById('budget-category').value,
                amount: parseFloat(document.getElementById('budget-amount').value),
                period: period,
                year: parseInt(document.getElementById('budget-year').value),
                month: period === 'monthly' ? parseInt(document.getElementById('budget-month').value) : null
            };

            Components.showLoading();

            if (this.editingBudget) {
                // 수정
                await api.budgets.update(this.editingBudget, formData);
                Components.showToast('예산이 수정되었습니다.');
            } else {
                // 추가
                await api.budgets.create(formData);
                Components.showToast('예산이 설정되었습니다.');
            }

            Components.hideModal('budget-modal');
            
            // 데이터 새로고침
            if (this.currentTab === 'budgets') {
                this.loadBudgets();
            } else if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }

        } catch (error) {
            console.error('Failed to save budget:', error);
            Components.showToast('예산 저장에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 예산 삭제
    async deleteBudget(budgetId) {
        if (!confirm('이 예산을 삭제하시겠습니까?')) {
            return;
        }

        try {
            Components.showLoading();
            await api.budgets.delete(budgetId);
            Components.showToast('예산이 삭제되었습니다.');
            
            // 데이터 새로고침
            if (this.currentTab === 'budgets') {
                this.loadBudgets();
            } else if (this.currentTab === 'dashboard') {
                this.updateDashboard();
            }

        } catch (error) {
            console.error('Failed to delete budget:', error);
            Components.showToast('예산 삭제에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 카테고리 모달 표시
    showCategoryModal(categoryId = null) {
        this.editingCategory = categoryId;
        
        if (categoryId) {
            // 수정 모드
            const category = this.categories.find(c => c.id === categoryId);
            if (category) {
                document.getElementById('category-modal-title').textContent = '카테고리 수정';
                document.getElementById('category-name').value = category.name;
                document.getElementById('category-color').value = category.color;
                document.getElementById('color-preview').style.backgroundColor = category.color;
            }
        } else {
            // 추가 모드
            document.getElementById('category-modal-title').textContent = '카테고리 추가';
            document.getElementById('category-form').reset();
            document.getElementById('category-color').value = '#3B82F6';
            document.getElementById('color-preview').style.backgroundColor = '#3B82F6';
        }

        Components.showModal('category-modal');
    }

    // 카테고리 저장
    async saveCategory() {
        try {
            const formData = {
                name: document.getElementById('category-name').value,
                color: document.getElementById('category-color').value
            };

            Components.showLoading();

            if (this.editingCategory) {
                // 수정
                await api.categories.update(this.editingCategory, formData);
                Components.showToast('카테고리가 수정되었습니다.');
            } else {
                // 추가
                await api.categories.create(formData);
                Components.showToast('카테고리가 추가되었습니다.');
            }

            Components.hideModal('category-modal');
            
            // 데이터 새로고침
            await this.loadCategories();

        } catch (error) {
            console.error('Failed to save category:', error);
            Components.showToast('카테고리 저장에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 카테고리 삭제
    async deleteCategory(categoryId) {
        if (!confirm('이 카테고리를 삭제하시겠습니까?\n관련된 지출이나 예산이 있으면 삭제할 수 없습니다.')) {
            return;
        }

        try {
            Components.showLoading();
            await api.categories.delete(categoryId);
            Components.showToast('카테고리가 삭제되었습니다.');
            
            // 데이터 새로고침
            await this.loadCategories();

        } catch (error) {
            console.error('Failed to delete category:', error);
            Components.showToast('카테고리 삭제에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 기본 카테고리 초기화
    async initializeCategories() {
        try {
            Components.showLoading();
            const result = await api.categories.initialize();
            Components.showToast(result.message);
            
            // 데이터 새로고침
            await this.loadCategories();

        } catch (error) {
            console.error('Failed to initialize categories:', error);
            Components.showToast('기본 카테고리 추가에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }

    // 지출 필터링
    async filterExpenses() {
        try {
            const params = {};
            
            const category = document.getElementById('expense-filter-category').value;
            const startDate = document.getElementById('expense-filter-start').value;
            const endDate = document.getElementById('expense-filter-end').value;

            if (category) params.category = category;
            if (startDate) params.start_date = startDate;
            if (endDate) params.end_date = endDate;

            Components.showLoading();
            const expenses = await api.expenses.getAll(params);
            
            const container = document.getElementById('expenses-list');
            if (expenses.length === 0) {
                container.innerHTML = '<p class="text-center text-gray-500">조건에 맞는 지출이 없습니다.</p>';
            } else {
                container.innerHTML = expenses
                    .map(expense => Components.renderExpenseItem(expense))
                    .join('');
            }

        } catch (error) {
            console.error('Failed to filter expenses:', error);
            Components.showToast('지출 필터링에 실패했습니다.', 'error');
        } finally {
            Components.hideLoading();
        }
    }
}

// 전역 함수들 (HTML에서 호출)
function showTab(tabName) {
    app.showTab(tabName);
}

function showExpenseModal(expenseId = null) {
    app.showExpenseModal(expenseId);
}

function editExpense(expenseId) {
    app.showExpenseModal(expenseId);
}

function deleteExpense(expenseId) {
    app.deleteExpense(expenseId);
}

function saveExpense() {
    app.saveExpense();
}

function showBudgetModal(budgetId = null) {
    app.showBudgetModal(budgetId);
}

function editBudget(budgetId) {
    app.showBudgetModal(budgetId);
}

function deleteBudget(budgetId) {
    app.deleteBudget(budgetId);
}

function saveBudget() {
    app.saveBudget();
}

function toggleMonthField() {
    app.toggleMonthField();
}

function showCategoryModal(categoryId = null) {
    app.showCategoryModal(categoryId);
}

function editCategory(categoryId) {
    app.showCategoryModal(categoryId);
}

function deleteCategory(categoryId) {
    app.deleteCategory(categoryId);
}

function saveCategory() {
    app.saveCategory();
}

function initializeCategories() {
    app.initializeCategories();
}

function filterExpenses() {
    app.filterExpenses();
}

function closeModal(modalId) {
    Components.hideModal(modalId);
}

// 앱 초기화
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new ExpenseTracker();
});
