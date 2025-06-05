// API 통신 클래스
class API {
    constructor() {
        this.baseURL = 'http://localhost:8000/api';
        this.headers = {
            'Content-Type': 'application/json'
        };
    }

    // 기본 fetch 래퍼
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.headers,
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    // GET 요청
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return this.request(url, { method: 'GET' });
    }

    // POST 요청
    async post(endpoint, data) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT 요청
    async put(endpoint, data) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE 요청
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // 지출 관련 API
    expenses = {
        // 지출 목록 조회
        getAll: (params = {}) => this.get('/expenses', params),
        
        // 지출 추가
        create: (data) => this.post('/expenses', data),
        
        // 지출 수정
        update: (id, data) => this.put(`/expenses/${id}`, data),
        
        // 지출 삭제
        delete: (id) => this.delete(`/expenses/${id}`),
        
        // 카테고리별 요약
        getCategorySummary: (params = {}) => this.get('/expenses/summary/category', params),
        
        // 월별 요약
        getMonthlySummary: (params = {}) => this.get('/expenses/summary/monthly', params)
    };

    // 예산 관련 API
    budgets = {
        // 예산 목록 조회
        getAll: (params = {}) => this.get('/budgets', params),
        
        // 예산 추가
        create: (data) => this.post('/budgets', data),
        
        // 예산 수정
        update: (id, data) => this.put(`/budgets/${id}`, data),
        
        // 예산 삭제
        delete: (id) => this.delete(`/budgets/${id}`),
        
        // 예산 현황
        getStatus: (params = {}) => this.get('/budgets/status', params),
        
        // 예산 알림
        getAlerts: (params = {}) => this.get('/budgets/alerts', params)
    };

    // 카테고리 관련 API
    categories = {
        // 카테고리 목록 조회
        getAll: () => this.get('/categories'),
        
        // 카테고리 추가
        create: (data) => this.post('/categories', data),
        
        // 카테고리 수정
        update: (id, data) => this.put(`/categories/${id}`, data),
        
        // 카테고리 삭제
        delete: (id) => this.delete(`/categories/${id}`),
        
        // 카테고리 사용 통계
        getUsage: (params = {}) => this.get('/categories/usage', params),
        
        // 기본 카테고리 초기화
        initialize: () => this.post('/categories/initialize', {})
    };
}

// 전역 API 인스턴스
window.api = new API();
