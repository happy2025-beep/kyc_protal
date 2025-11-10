/**
 * KYC 注册流程主应用
 * 4步流程: 基本信息 -> 运营商三要素认证 -> 银行卡绑定 -> 完成
 */

window.kycApp = {
    // 当前步骤
    currentStep: 1,
    
    // 省市区数据
    regionsData: null,
    
    // 用户数据存储
    userData: {
        // 步骤1: 基本信息
        realName: '',
        idCard: '',
        mobile: '',
        province: '',
        provinceCode: '',
        city: '',
        cityCode: '',
        district: '',
        districtCode: '',
        address: '',
        email: '',
        
        // 步骤2: 运营商认证
        authToken: '',
        authCode: '',
        frontImageUrl: '',  // 身份证正面图片URL
        backImageUrl: '',   // 身份证反面图片URL
        
        // 步骤3: 银行卡
        bankCard: '',
        bankName: '',
        bankCode: '',
        bankPhone: '',
        smsCode: '',
        
        // 其他
        session_id: ''
    },

    /**
     * 初始化应用
     */
    async init() {
        console.log('KYC App 初始化...');
        
        // 加载省市区数据
        await this.loadRegionsData();
        
        // 初始化步骤1
        this.setupStep1();
        
        // ⭐ 从 sessionStorage 恢复数据和步骤
        this.loadUserDataFromStorage();
        
        // ⭐ 恢复上次的步骤（如果有）
        let savedStep = 1;
        try {
            const stepStr = sessionStorage.getItem('kycCurrentStep');
            if (stepStr) {
                savedStep = parseInt(stepStr, 10);
                console.log('恢复上次步骤:', savedStep);
            }
        } catch (error) {
            console.error('恢复步骤失败:', error);
        }
        
        // 设置当前步骤
        this.switchToStep(savedStep);
        
        console.log('KYC App 初始化完成');
    },

    /**
     * 加载省市区数据
     */
    async loadRegionsData() {
        try {
            const response = await fetch('data/pca-code.json');
            this.regionsData = await response.json();
            console.log('省市区数据加载成功', this.regionsData);
            console.log(`共加载 ${this.regionsData.length} 个省级行政区`);
        } catch (error) {
            console.error('加载省市区数据失败:', error);
            this.showMessage('error', '加载地区数据失败，请刷新页面重试');
        }
    },

    /**
     * 设置步骤1: 基本信息
     */
    setupStep1() {
        // ========== 生成随机邮箱 ==========
        const emailField = document.getElementById('email');
        if (emailField && !emailField.value) {
            // 生成随机字符串（8位）
            const randomStr = Math.random().toString(36).substring(2, 10);
            const timestamp = Date.now().toString().slice(-6);
            // 使用真实邮箱域名
            const domains = ['qq.com', '163.com', 'gmail.com', '126.com'];
            const randomDomain = domains[Math.floor(Math.random() * domains.length)];
            emailField.value = `user_${randomStr}${timestamp}@${randomDomain}`;
        }

        const form = document.getElementById('step1Form');
        const provinceSelect = document.getElementById('province');
        const citySelect = document.getElementById('city');
        const districtSelect = document.getElementById('district');

        // ========== 身份证上传处理 ==========
        const uploadFront = document.getElementById('uploadFront');
        const uploadBack = document.getElementById('uploadBack');
        const idCardFrontInput = document.getElementById('idCardFront');
        const idCardBackInput = document.getElementById('idCardBack');
        const previewFront = document.getElementById('previewFront');
        const previewBack = document.getElementById('previewBack');
        const placeholderFront = document.getElementById('placeholderFront');
        const placeholderBack = document.getElementById('placeholderBack');
        const reuploadFront = document.getElementById('reuploadFront');
        const reuploadBack = document.getElementById('reuploadBack');
        
        // 点击上传区域触发文件选择 - 正面
        uploadFront.addEventListener('click', (e) => {
            // 如果点击的是重新上传按钮，不触发
            if (e.target.id === 'reuploadFront' || e.target.closest('#reuploadFront')) {
                return;
            }
            idCardFrontInput.click();
        });
        
        // 点击上传区域触发文件选择 - 反面
        uploadBack.addEventListener('click', (e) => {
            // 如果点击的是重新上传按钮，不触发
            if (e.target.id === 'reuploadBack' || e.target.closest('#reuploadBack')) {
                return;
            }
            idCardBackInput.click();
        });
        
        // 身份证正面上传
        idCardFrontInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // 显示预览
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewFront.src = event.target.result;
                    previewFront.style.display = 'block';
                    placeholderFront.style.display = 'none';
                    reuploadFront.style.display = 'block';
                };
                reader.readAsDataURL(file);
                
                // 上传到OSS并进行OCR识别
                await this.uploadIdCardAndOCR(file, 'front');
            }
        });
        
        // 身份证反面上传
        idCardBackInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                // 显示预览
                const reader = new FileReader();
                reader.onload = (event) => {
                    previewBack.src = event.target.result;
                    previewBack.style.display = 'block';
                    placeholderBack.style.display = 'none';
                    reuploadBack.style.display = 'block';
                };
                reader.readAsDataURL(file);
                
                // 上传到OSS
                await this.uploadIdCardAndOCR(file, 'back');
            }
        });
        
        // 重新上传按钮 - 正面
        reuploadFront.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            e.preventDefault();  // 阻止默认行为
            console.log('🔄 点击重新上传身份证正面');
            idCardFrontInput.value = ''; // 清空input，允许选择同一文件
            idCardFrontInput.click();
        });
        
        // 重新上传按钮 - 反面
        reuploadBack.addEventListener('click', (e) => {
            e.stopPropagation(); // 阻止事件冒泡
            e.preventDefault();  // 阻止默认行为
            console.log('🔄 点击重新上传身份证反面');
            idCardBackInput.value = ''; // 清空input，允许选择同一文件
            idCardBackInput.click();
        });
        
        // 初始化省份下拉框
        if (this.regionsData && Array.isArray(this.regionsData)) {
            provinceSelect.innerHTML = '<option value="">请选择省份</option>';
            this.regionsData.forEach(province => {
                const option = document.createElement('option');
                option.value = province.code;
                option.textContent = province.name;
                provinceSelect.appendChild(option);
            });
        } else {
            console.warn('省市区数据未加载或格式不正确');
            provinceSelect.innerHTML = '<option value="">数据加载中...</option>';
            provinceSelect.disabled = true;
        }

        // 省份选择事件
        provinceSelect.addEventListener('change', (e) => {
            const provinceCode = e.target.value;

            // 重置城市和区县下拉框
            citySelect.innerHTML = '<option value="">请选择城市</option>';
            districtSelect.innerHTML = '<option value="">请选择区县</option>';
            citySelect.disabled = !provinceCode;
            districtSelect.disabled = true;

            // 清除错误提示
            document.getElementById('regionError').textContent = '';

            if (provinceCode) {
                const province = this.regionsData.find(p => p.code === provinceCode);
                if (province && province.children) {
                    // 添加城市选项
                    province.children.forEach(city => {
                        const option = document.createElement('option');
                        option.value = city.code;
                        option.textContent = city.name;
                        citySelect.appendChild(option);
                    });

                    // 如果只有一个城市（直辖市情况），自动选中并触发区县加载
                    if (province.children.length === 1) {
                        citySelect.value = province.children[0].code;
                        citySelect.dispatchEvent(new Event('change'));
                    }
                }
            }
        });

        // 城市选择事件
        citySelect.addEventListener('change', (e) => {
            const cityCode = e.target.value;

            // 重置区县下拉框
            districtSelect.innerHTML = '<option value="">请选择区县</option>';
            districtSelect.disabled = !cityCode;

            // 清除错误提示
            document.getElementById('regionError').textContent = '';

            if (cityCode) {
                const provinceCode = provinceSelect.value;
                const province = this.regionsData.find(p => p.code === provinceCode);
                if (province) {
                    const city = province.children.find(c => c.code === cityCode);
                    if (city && city.children) {
                        // 添加区县选项
                        city.children.forEach(district => {
                            const option = document.createElement('option');
                            option.value = district.code;
                            option.textContent = district.name;
                            districtSelect.appendChild(option);
                        });

                        // 启用区县选择框并添加视觉提示
                        districtSelect.style.transition = 'all 0.3s ease';
                    }
                }
            }
        });

        // 区县选择事件 - 清除错误提示
        districtSelect.addEventListener('change', () => {
            if (districtSelect.value) {
                document.getElementById('regionError').textContent = '';
            }
        });
        
        // 表单提交
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 验证表单
            if (!this.validateStep1()) {
                return;
            }
            
            const mobile = document.getElementById('mobile').value.trim();
            const mobileSmsCode = document.getElementById('mobileSmsCode').value.trim();
            
            // 调用后台验证码验证接口
            this.showLoading();
            
            try {
                const response = await fetch('api/verify-sms-code', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        cell_phone: mobile,
                        code: mobileSmsCode,
                        isFlat: false
                    })
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    this.hideLoading();
                    this.showMessage('error', result.message || '验证码错误，请重新输入');
                    return;
                }
                
                // 验证码验证成功，保存基本数据
                const realNameValue = document.getElementById('realName').value.trim();
                const idCardValue = document.getElementById('idCard').value.trim();
                
                console.log('🔍 [步骤1提交] 从表单获取的值:');
                console.log('  realName元素:', document.getElementById('realName'));
                console.log('  realName值:', realNameValue);
                console.log('  idCard元素:', document.getElementById('idCard'));
                console.log('  idCard值:', idCardValue);
                
                this.userData.realName = realNameValue;
                this.userData.idCard = idCardValue;
                this.userData.mobile = mobile;
                this.userData.smsVerifyCode = mobileSmsCode; // 保存短信验证码
                this.userData.provinceCode = document.getElementById('province').value;
                this.userData.province = document.getElementById('province').selectedOptions[0].text;
                this.userData.cityCode = document.getElementById('city').value;
                this.userData.city = document.getElementById('city').selectedOptions[0].text;
                this.userData.districtCode = document.getElementById('district').value;
                this.userData.district = document.getElementById('district').selectedOptions[0].text;
                this.userData.address = document.getElementById('address').value.trim();
                this.userData.email = document.getElementById('email').value.trim();
                this.userData.loginAccount = document.getElementById('loginAccount').value.trim();
                this.userData.loginPassword = 'aa112233'; // 默认密码（8位，包含字母和数字）
                
                // ⭐ 调用保存基本信息+风险评估接口
                try {
                    // 风险评估答题结果（格式：题号:答案ID:权重）
                    // 示例：21:21:1 表示第21题选择答案21，权重为1
                    const questionResult = "21:21:1,22:24:1,23:25:1,24:27:1,25:29:1,26:31:1,27:34:1,28:35:1,29:38:1,30:40:1";

                    // ⭐ 添加调试日志
                    console.log('🔍 准备保存的用户数据:');
                    console.log('  姓名:', this.userData.realName);
                    console.log('  身份证:', this.userData.idCard);
                    console.log('  手机号:', this.userData.mobile);

                    const regInfo = {
                        customerNotice: true,           // 客户须知已确认
                        riskDisclosure: true,           // 风险揭示已确认
                        alreadyUploadFlash: false,      // 是否上传过Flash（已废弃）
                        rsxyFlag: false,                // 认识协议标志
                        cdxyFlag: false,                // 承诺协议标志
                        riskInfo: {
                            type: 'riskConfigPerson',   // 风险评估类型：个人
                            questionResult: questionResult,  // 答题结果
                            answerFile: '',             // 答题文件（留空）
                            riskAssessmentWay: '0'      // 评估方式：0=在线答题
                        },
                        formCompData: {},               // 企业数据（个人用户留空）
                        formPersonData: {               // ⭐ 个人数据（添加姓名、身份证等）
                            realName: this.userData.realName,
                            idCard: this.userData.idCard,
                            mobile: this.userData.mobile,
                            email: this.userData.email,
                            province: this.userData.province,
                            city: this.userData.city,
                            district: this.userData.district,
                            address: this.userData.address,
                            idCardFrontFileId: this.userData.idCardFrontFileId,
                            idCardBackFileId: this.userData.idCardBackFileId
                        },
                        stepActive: 1                   // 当前步骤
                    };

                    const saveInfoResponse = await fetch('api/save-registration-info', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userType: '2',                              // 用户类型：2=个人用户
                            userRegAccount: this.userData.mobile,       // ⭐ 统一使用手机号作为注册账号
                            userRegInfo: JSON.stringify(regInfo),       // 注册信息转为JSON字符串
                            app_id: 'qoRz2jvwG0HmaEfxr7lV'
                        })
                    });

                    const saveInfoResult = await saveInfoResponse.json();

                    this.hideLoading();

                    if (!saveInfoResult.success) {
                        this.showMessage('error', saveInfoResult.message || '保存信息失败，请重试');
                        return;
                    }

                    console.log('注册信息和风险评估提交成功');
                    
                    // 保存到 sessionStorage
                    this.saveUserDataToStorage();
                    
                    this.showMessage('success', '注册成功！');
                    
                    // 进入步骤2
                    setTimeout(() => {
                        this.switchToStep(2);
                    }, 1000);
                    
                } catch (registerError) {
                    this.hideLoading();
                    console.error('注册或保存信息失败:', registerError);
                    this.showMessage('error', '注册失败，请稍后重试');
                    return;
                }
            } catch (error) {
                this.hideLoading();
                console.error('验证码验证失败:', error);
                this.showMessage('error', '网络错误，请稍后重试');
            }
        });
        
        // 手机号实时校验
        const mobileInput = document.getElementById('mobile');
        const mobileError = document.getElementById('mobileError');
        mobileInput.addEventListener('blur', async () => {
            const mobile = mobileInput.value.trim();

            // 先进行基本格式校验
            if (!mobile) {
                mobileError.textContent = '请输入手机号码';
                return;
            }
            if (!this.validatePhone(mobile)) {
                mobileError.textContent = '请输入正确的手机号码';
                return;
            }

            // 调用后台校验接口（注意：手机号字段名是 cellPhone）
            const isValid = await this.validateFieldValue('cellPhone', mobile);
            if (isValid) {
                mobileError.textContent = '';
                mobileError.style.color = '#10b981';
                mobileError.textContent = '✓ 手机号可用';
                setTimeout(() => {
                    if (mobileError.textContent === '✓ 手机号可用') {
                        mobileError.textContent = '';
                    }
                }, 2000);
            } else {
                mobileError.textContent = '该手机号已被注册，请换一个';
            }
        });

        // 登录账号实时校验
        const loginAccountInput = document.getElementById('loginAccount');
        const loginAccountError = document.getElementById('loginAccountError');
        loginAccountInput.addEventListener('blur', async () => {
            const account = loginAccountInput.value.trim();
            const accountRegex = /^[a-zA-Z0-9-]{4,20}$/;

            // 先进行基本格式校验
            if (!account) {
                loginAccountError.textContent = '请输入登录账号';
                return;
            }
            if (!accountRegex.test(account)) {
                loginAccountError.textContent = '用户名由4-20位英文、数字或连字符组成';
                return;
            }

            // 调用后台校验接口
            const isValid = await this.validateFieldValue('account', account);
            if (isValid) {
                loginAccountError.textContent = '';
                loginAccountError.style.color = '#10b981';
                loginAccountError.textContent = '✓ 账号可用';
                setTimeout(() => {
                    if (loginAccountError.textContent === '✓ 账号可用') {
                        loginAccountError.textContent = '';
                    }
                }, 2000);
            } else {
                loginAccountError.textContent = '该账号已被使用，请换一个';
            }
        });

        // 邮箱已隐藏并自动生成，移除实时校验

        // 发送手机验证码
        document.getElementById('btnSendMobileSms').addEventListener('click', async () => {
            await this.sendMobileSmsCode();
        });
    },

    /**
     * 上传身份证并进行OCR识别（仅处理正面）
     * @param {File} file - 图片文件
     * @param {string} side - 'front' 或 'back'
     */
    async uploadIdCardAndOCR(file, side) {
        this.showLoading(side === 'front' ? '正在上传并识别身份证...' : '正在上传身份证反面...');
        
        try {
            // 将文件转换为Base64
            const base64String = await this.fileToBase64(file);
            
            // 生成文件名
            const fileName = `idcard_${side}_${Date.now()}.jpg`;
            
            // ⭐ card_type 固定为 imgAttach2（OCR接口仅处理身份证正面）
            const cardType = 'imgAttach2';
            
            // ⭐ 调试日志
            console.log('🔍 [DEBUG] 准备调用OCR接口');
            console.log('🔍 [DEBUG] fileName:', fileName);
            console.log('🔍 [DEBUG] cardType:', cardType, '(固定值)');
            console.log('🔍 [DEBUG] side:', side);
            console.log('🔍 [DEBUG] base64长度:', base64String ? base64String.length : 0);
            
            // 调用OCR接口（上传+绑定+OCR）
            const response = await fetch('api/upload-and-bind-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    file_name: fileName,
                    base64_string: base64String,
                    card_type: cardType  // 固定为 imgAttach2
                })
            });
            
            console.log('🔍 [DEBUG] HTTP状态:', response.status);
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.message || '上传失败');
            }
            
            console.log('🔍 [DEBUG] 完整响应数据:', result.data);

            // 打印 fileID 信息
            console.log('📎 [文件信息] file_id:', result.data.file_id);
            console.log('📎 [文件信息] file_path:', result.data.file_path);
            console.log('📎 [文件信息] suffix:', result.data.suffix);
            console.log('📎 [文件信息] 标准格式 fileId:', `/user/download_file.htm?fileId=${result.data.file_id}${result.data.suffix || ''}`);

            // 保存file_id、file_path 和 suffix
            if (side === 'front') {
                this.userData.idCardFrontFileId = result.data.file_id;
                this.userData.idCardFrontFilePath = result.data.file_path;
                this.userData.idCardFrontSuffix = result.data.suffix || '';

                console.log('✅ 身份证正面文件信息已保存:');
                console.log('   - file_id:', this.userData.idCardFrontFileId);
                console.log('   - file_path:', this.userData.idCardFrontFilePath);
                console.log('   - suffix:', this.userData.idCardFrontSuffix);

                // ⭐ OCR接口仅处理身份证正面，提取识别数据
                let ocrData = null;
                
                // 优先从上传结果中提取（通常OCR在这里）
                if (result.data.upload_result) {
                    ocrData = result.data.upload_result;
                    console.log('🔍 [DEBUG] 从upload_result中提取OCR数据:', ocrData);
                }
                
                // 如果上传结果中没有，尝试绑定结果
                if (!ocrData || (!ocrData.name && !ocrData.idCard && !ocrData.real_name && !ocrData.certName && !ocrData.certNo)) {
                    if (result.data.bind_result && result.data.bind_result.data) {
                        ocrData = result.data.bind_result.data[0];
                        console.log('🔍 [DEBUG] 从bind_result中提取OCR数据:', ocrData);
                    }
                }
                
                // 最后尝试从响应根部提取
                if (!ocrData || (!ocrData.name && !ocrData.idCard && !ocrData.real_name && !ocrData.certName && !ocrData.certNo)) {
                    console.log('🔍 [DEBUG] 前两个位置无有效OCR数据，尝试从响应根部提取');
                    if (result.data.name || result.data.idCard || result.data.real_name || result.data.certName || result.data.certNo) {
                        ocrData = result.data;
                        console.log('🔍 [DEBUG] 从响应根部提取到数据:', ocrData);
                    }
                }
                
                // 提取OCR识别的姓名和身份证号
                if (ocrData) {
                    this.fillOCRDataFromBind(ocrData);
                } else {
                    console.warn('⚠️ 未找到OCR数据，用户需要手动填写');
                }
            } else {
                // 反面不进行OCR，仅保存文件信息
                this.userData.idCardBackFileId = result.data.file_id;
                this.userData.idCardBackFilePath = result.data.file_path;
                this.userData.idCardBackSuffix = result.data.suffix || '';

                console.log('✅ 身份证反面文件信息已保存:');
                console.log('   - file_id:', this.userData.idCardBackFileId);
                console.log('   - file_path:', this.userData.idCardBackFilePath);
                console.log('   - suffix:', this.userData.idCardBackSuffix);
            }
            
            this.hideLoading();
            
            // 仅正面OCR成功时显示提示
            if (side === 'front') {
                console.log('✅ 身份证正面上传并识别完成');
            } else {
                console.log('✅ 身份证反面上传完成');
            }
            
        } catch (error) {
            this.hideLoading();
            console.error('上传身份证失败:', error);
            this.showMessage('error', error.message || '上传失败，请重试');
        }
    },
    
    /**
     * 将File对象转换为Base64字符串
     * @param {File} file - 文件对象
     * @returns {Promise<string>} Base64字符串（不含data:image前缀）
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                // 移除 "data:image/jpeg;base64," 前缀
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },
    
    /**
     * 从绑定接口的响应中提取并填充OCR数据
     * @param {Object} bindData - 绑定接口返回的数据
     */
    fillOCRDataFromBind(bindData) {
        if (!bindData) return;

        const ocrResultGroup = document.getElementById('ocrResultGroup');
        const ocrName = document.getElementById('ocrName');
        const ocrIdCard = document.getElementById('ocrIdCard');

        console.log('🔍 [DEBUG] 原始绑定数据:', bindData);

        // 检查是否有 result 字段，如果有且是字符串，则解析它
        let ocrData = bindData;
        if (bindData.result && typeof bindData.result === 'string') {
            try {
                ocrData = JSON.parse(bindData.result);
                console.log('🔍 [DEBUG] 解析后的OCR数据:', ocrData);
            } catch (e) {
                console.error('解析OCR数据失败:', e);
            }
        }

        // 从解析后的数据中提取信息（支持多种可能的字段名）
        // OCR接口返回的字段：certName=姓名, certNo=身份证号, address=地址
        const name = ocrData.certName || ocrData.name || ocrData.real_name || ocrData.userName ||
                     bindData.certName || bindData.name || bindData.real_name || bindData.userName || '';
        const idCardNumber = ocrData.certNo || ocrData.idCard || ocrData.id_card || ocrData.cardNo || ocrData.idCardNumber ||
                            bindData.certNo || bindData.idCard || bindData.id_card || bindData.cardNo || '';
        const address = ocrData.address || bindData.address || '';

        console.log('🔍 [DEBUG] 提取的姓名:', name);
        console.log('🔍 [DEBUG] 提取的身份证:', idCardNumber);
        console.log('🔍 [DEBUG] 提取的地址:', address);

        // 显示OCR识别结果
        if (name) {
            ocrName.textContent = name;
            document.getElementById('realName').value = name;
            this.userData.realName = name;
        }

        if (idCardNumber) {
            ocrIdCard.textContent = idCardNumber;
            document.getElementById('idCard').value = idCardNumber;
            this.userData.idCard = idCardNumber;
        }

        // 解析并填充地址信息
        if (address) {
            console.log('🏠 开始解析地址:', address);
            this.parseAndFillAddress(address);
        }

        if (name || idCardNumber) {
            ocrResultGroup.style.display = 'block';
            console.log('✅ OCR识别成功');
        } else {
            console.warn('⚠️ 未从绑定接口中获取到OCR数据，请手动填写');
        }
    },

    /**
     * 解析地址字符串并自动填充省市区
     * @param {string} fullAddress - 完整地址，如 "山东省栖霞市蛇窝泊镇跃进村103号"
     */
    parseAndFillAddress(fullAddress) {
        if (!fullAddress || !this.regionsData) {
            console.warn('地址或省市区数据为空');
            return;
        }

        try {
            let parsedData = {
                province: null,
                city: null,
                district: null,
                detailAddress: fullAddress
            };

            // 1. 匹配省份
            for (const province of this.regionsData) {
                const provinceName = province.name;
                // 匹配省份（支持带"省"或不带"省"）
                const provincePattern = provinceName.replace(/省|市|自治区|特别行政区/, '');
                if (fullAddress.includes(provinceName) || fullAddress.includes(provincePattern)) {
                    parsedData.province = province;
                    console.log('✅ 匹配到省份:', provinceName);

                    // 从地址中移除省份
                    fullAddress = fullAddress.replace(provinceName, '').replace(provincePattern, '');
                    break;
                }
            }

            // 2. 匹配城市和区县
            if (parsedData.province && parsedData.province.children) {
                // 先尝试匹配区县（因为有些区县名称包含在城市名中）
                let foundDistrict = false;

                for (const city of parsedData.province.children) {
                    if (city.children) {
                        for (const district of city.children) {
                            const districtName = district.name;
                            const districtPattern = districtName.replace(/区|县|市/, '');

                            if (fullAddress.includes(districtName) || fullAddress.includes(districtPattern)) {
                                parsedData.city = city;
                                parsedData.district = district;
                                console.log('✅ 匹配到城市:', city.name);
                                console.log('✅ 匹配到区县:', districtName);

                                // 从地址中移除城市和区县名称
                                fullAddress = fullAddress.replace(city.name, '').replace(districtName, '').replace(districtPattern, '');
                                foundDistrict = true;
                                break;
                            }
                        }
                    }
                    if (foundDistrict) break;
                }

                // 如果没有匹配到区县，尝试只匹配城市
                if (!foundDistrict) {
                    for (const city of parsedData.province.children) {
                        const cityName = city.name;
                        const cityPattern = cityName.replace(/市|州|盟|地区/, '');

                        if (fullAddress.includes(cityName) || fullAddress.includes(cityPattern)) {
                            parsedData.city = city;
                            console.log('✅ 匹配到城市:', cityName);
                            fullAddress = fullAddress.replace(cityName, '').replace(cityPattern, '');
                            break;
                        }
                    }
                }
            }

            // 3. 剩余部分作为详细地址
            parsedData.detailAddress = fullAddress.trim();
            console.log('🏠 详细地址:', parsedData.detailAddress);

            // 4. 自动填充表单
            this.autoFillRegionSelects(parsedData);

        } catch (error) {
            console.error('地址解析失败:', error);
        }
    },

    /**
     * 自动填充省市区选择器
     * @param {Object} parsedData - 解析后的地址数据
     */
    async autoFillRegionSelects(parsedData) {
        const provinceSelect = document.getElementById('province');
        const citySelect = document.getElementById('city');
        const districtSelect = document.getElementById('district');
        const addressInput = document.getElementById('address');

        try {
            // 1. 填充省份
            if (parsedData.province) {
                provinceSelect.value = parsedData.province.code;

                // 触发省份change事件，加载城市
                provinceSelect.dispatchEvent(new Event('change'));

                // 等待DOM更新
                await new Promise(resolve => setTimeout(resolve, 100));

                // 2. 填充城市
                if (parsedData.city) {
                    citySelect.value = parsedData.city.code;

                    // 触发城市change事件，加载区县
                    citySelect.dispatchEvent(new Event('change'));

                    // 等待DOM更新
                    await new Promise(resolve => setTimeout(resolve, 100));

                    // 3. 填充区县
                    if (parsedData.district) {
                        districtSelect.value = parsedData.district.code;
                        districtSelect.dispatchEvent(new Event('change'));
                    }
                }
            }

            // 4. 填充详细地址
            if (parsedData.detailAddress) {
                addressInput.value = parsedData.detailAddress;
                this.userData.address = parsedData.detailAddress;
            }

            console.log('✅ 地址自动填充完成');

        } catch (error) {
            console.error('自动填充地址失败:', error);
        }
    },

    /**
     * 发送手机验证码
     */
    async sendMobileSmsCode() {
        const btnSendMobileSms = document.getElementById('btnSendMobileSms');
        
        // 按钮禁用状态
        if (btnSendMobileSms.disabled) {
            return;
        }
        
        // 验证手机号
        const mobile = document.getElementById('mobile').value.trim();
        
        // ⭐ 添加调试日志
        console.log('🔍 [DEBUG] 获取到的手机号:', mobile);
        console.log('🔍 [DEBUG] 手机号类型:', typeof mobile);
        console.log('🔍 [DEBUG] 手机号长度:', mobile.length);
        
        if (!mobile) {
            this.showMessage('error', '请先输入手机号码');
            return;
        }
        
        if (!this.validatePhone(mobile)) {
            this.showMessage('error', '请输入正确的手机号码');
            return;
        }
        
        // ⭐ 添加调试日志 - 准备发送的数据
        const requestPayload = {
            cell_phone: mobile,
            send_type: 'sms',
            biz_type: 'reg_mobile'
        };
        console.log('🔍 [DEBUG] 准备发送的请求数据:', JSON.stringify(requestPayload, null, 2));
        
        this.showLoading();
        
        try {
            // 调用发送验证码接口
            const response = await fetch('api/send-sms-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestPayload)
            });
            
            // ⭐ 添加调试日志 - 响应状态
            console.log('🔍 [DEBUG] HTTP响应状态:', response.status);
            console.log('🔍 [DEBUG] HTTP响应头:', Object.fromEntries(response.headers));
            
            const result = await response.json();
            
            // ⭐ 添加调试日志 - 响应数据
            console.log('🔍 [DEBUG] 服务器返回数据:', JSON.stringify(result, null, 2));
            
            this.hideLoading();
            
            if (result.success) {
                this.showMessage('success', '验证码已发送，请查收短信');
                
                // 倒计时
                this.startCountdown(btnSendMobileSms, 60);
            } else {
                console.error('❌ [ERROR] 发送验证码失败:', result.message);
                throw new Error(result.message || '发送验证码失败');
            }
        } catch (error) {
            this.hideLoading();
            console.error('发送验证码失败:', error);
            this.showMessage('error', error.message || '发送验证码失败，请重试');
        }
    },

    /**
     * 验证步骤1
     */
    validateStep1() {
        console.log('🔍 [DEBUG] 开始验证步骤1');
        console.log('🔍 [DEBUG] userData:', this.userData);
        let isValid = true;
        
        // 验证身份证照片（正反面都必须上传）
        if (!this.userData.idCardFrontFileId) {
            console.log('❌ 身份证正面未上传');
            document.getElementById('idCardFrontError').textContent = '请上传身份证正面照';
            isValid = false;
        } else {
            document.getElementById('idCardFrontError').textContent = '';
        }
        
        if (!this.userData.idCardBackFileId) {
            console.log('❌ 身份证反面未上传');
            document.getElementById('idCardBackError').textContent = '请上传身份证反面照';
            isValid = false;
        } else {
            document.getElementById('idCardBackError').textContent = '';
        }
        
        // 验证姓名（OCR后应该已填写）
        const realName = document.getElementById('realName').value.trim();
        if (!realName) {
            console.log('❌ 姓名未填写');
            document.getElementById('realNameError').textContent = '请输入姓名';
            isValid = false;
        } else if (!/^[\u4e00-\u9fa5]{2,10}$/.test(realName)) {
            document.getElementById('realNameError').textContent = '姓名格式不正确';
            isValid = false;
        } else {
            document.getElementById('realNameError').textContent = '';
        }
        
        // 验证身份证号（OCR后应该已填写）
        const idCard = document.getElementById('idCard').value.trim();
        if (!idCard) {
            console.log('❌ 身份证号未填写');
            document.getElementById('idCardError').textContent = '请输入身份证号码';
            isValid = false;
        } else if (!this.validateIdCard(idCard)) {
            console.log('❌ 身份证号格式不正确');
            document.getElementById('idCardError').textContent = '请输入正确的18位身份证号码';
            isValid = false;
        } else {
            document.getElementById('idCardError').textContent = '';
        }
        
        // 验证手机号
        const mobile = document.getElementById('mobile').value.trim();
        if (!mobile) {
            console.log('❌ 手机号未填写');
            document.getElementById('mobileError').textContent = '请输入手机号码';
            isValid = false;
        } else if (!this.validatePhone(mobile)) {
            document.getElementById('mobileError').textContent = '请输入正确的手机号码';
            isValid = false;
        } else {
            document.getElementById('mobileError').textContent = '';
        }
        
        // 验证手机验证码
        const mobileSmsCode = document.getElementById('mobileSmsCode').value.trim();
        if (!mobileSmsCode) {
            document.getElementById('mobileSmsCodeError').textContent = '请输入短信验证码';
            isValid = false;
        } else if (mobileSmsCode.length !== 6) {
            document.getElementById('mobileSmsCodeError').textContent = '验证码为6位数字';
            isValid = false;
        } else {
            document.getElementById('mobileSmsCodeError').textContent = '';
        }
        
        // 验证地区
        const province = document.getElementById('province').value;
        const city = document.getElementById('city').value;
        const district = document.getElementById('district').value;
        if (!province || !city || !district) {
            document.getElementById('regionError').textContent = '请选择完整的省市区';
            isValid = false;
        } else {
            document.getElementById('regionError').textContent = '';
        }
        
        // 验证详细地址
        const address = document.getElementById('address').value.trim();
        if (!address) {
            document.getElementById('addressError').textContent = '请输入详细地址';
            isValid = false;
        } else if (address.length < 5) {
            document.getElementById('addressError').textContent = '详细地址不能少于5个字符';
            isValid = false;
        } else {
            document.getElementById('addressError').textContent = '';
        }

        // 邮箱已隐藏并自动生成，跳过验证
        
        // 验证登录账号
        const loginAccount = document.getElementById('loginAccount').value.trim();
        const accountRegex = /^[a-zA-Z0-9-]{4,20}$/;
        if (!loginAccount) {
            document.getElementById('loginAccountError').textContent = '请输入登录账号';
            isValid = false;
        } else if (!accountRegex.test(loginAccount)) {
            document.getElementById('loginAccountError').textContent = '用户名由4-20位英文、数字或连字符组成';
            isValid = false;
        } else {
            document.getElementById('loginAccountError').textContent = '';
        }
        
        console.log('🔍 [DEBUG] 步骤1验证结果:', isValid);
        
        if (!isValid) {
            // 滚动到第一个错误位置
            const firstError = document.querySelector('.error-message:not(:empty)');
            if (firstError) {
                firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
        
        return isValid;
    },

    /**
     * 设置步骤2: 电子合同实名认证
     */
    setupStep2() {
        const form = document.getElementById('step2Form');
        const btnStartAuth = document.getElementById('btnStartAuth');
        const btnBackToStep1 = document.getElementById('btnBackToStep1');
        const eContractFrame = document.getElementById('eContractFrame');
        const eContractContainer = document.getElementById('eContractContainer');
        const startAuthContainer = document.getElementById('startAuthContainer');
        const authSuccessContainer = document.getElementById('authSuccessContainer');

        // 重置步骤2的显示状态：只显示开始认证按钮
        if (eContractContainer) eContractContainer.style.display = 'none';
        if (authSuccessContainer) authSuccessContainer.style.display = 'none';
        if (startAuthContainer) startAuthContainer.style.display = 'block'; // 显示开始认证按钮

        // 显示步骤1填写的信息
        this.displayStep1Data();

        // 返回步骤1按钮
        btnBackToStep1.addEventListener('click', () => {
            this.switchToStep(1);
        });

        // 开始认证按钮
        btnStartAuth.addEventListener('click', async () => {
            await this.startEContractAuth();
        });

        // 测试按钮：手动触发认证成功
        const btnTestAuthSuccess = document.getElementById('btnTestAuthSuccess');
        if (btnTestAuthSuccess) {
            btnTestAuthSuccess.addEventListener('click', () => {
                console.log('🧪 测试按钮被点击，手动触发认证成功流程...');
                this.handleAuthSuccess();
            });
        }

        // 监听 iframe 加载事件
        eContractFrame.addEventListener('load', () => {
            console.log('电子合同页面已加载');
        });
        
        // 监听 iframe 加载错误
        eContractFrame.addEventListener('error', (e) => {
            console.error('电子合同页面加载失败:', e);
            this.showMessage('error', '页面加载失败，请点击"在新窗口打开"按钮');
        });
        
        // 监听来自 iframe 的消息（用于检测认证完成）
        const messageHandler = (event) => {
            // 安全检查：确保消息来自认证服务器
            // 支持两个来源：https://www.asign.cn 和 http://1.95.91.139:8088
            const allowedOrigins = ['https://www.asign.cn', 'http://1.95.91.139:8088'];
            if (!allowedOrigins.includes(event.origin)) {
                return;
            }

            console.log('📨 收到来自电子合同页面的消息:', event.data);
            console.log('📨 消息来源:', event.origin);
            console.log('🔍 消息类型:', typeof event.data);

            // 解析消息数据（可能是字符串或对象）
            let messageData;
            try {
                if (typeof event.data === 'string') {
                    messageData = JSON.parse(event.data);
                    console.log('🔄 已解析 JSON 字符串:', messageData);
                } else {
                    messageData = event.data;
                }
            } catch (error) {
                console.error('❌ 解析消息失败:', error);
                return;
            }

            console.log('🔍 解析后的数据:', messageData);
            console.log('🔍 code 值:', messageData.code);
            console.log('🔍 code 类型:', typeof messageData.code);

            // 处理认证完成消息
            // 格式：{"code":100000,"msg":"认证成功"}
            // 使用 == 而不是 === 以支持数字和字符串
            if (messageData && (messageData.code == 100000 || messageData.code === '100000')) {
                console.log('✅ 检测到认证成功消息（postMessage）');
                console.log('🔧 准备调用 handleAuthSuccess...');

                // 确保异步调用
                Promise.resolve().then(() => {
                    this.handleAuthSuccess();
                }).catch(err => {
                    console.error('❌ handleAuthSuccess 调用失败:', err);
                });
            } else {
                console.log('⚠️ 消息不符合认证成功条件');
                console.log('  - messageData 存在?', !!messageData);
                console.log('  - code 值:', messageData ? messageData.code : 'N/A');
            }
        };

        window.addEventListener('message', messageHandler);

        // 保存监听器引用，以便后续清理
        this.messageHandler = messageHandler;
        
        // 旧的表单逻辑（备用）
        const btnSendAuthCode = document.getElementById('btnSendAuthCode');
        
        // ⭐ 步骤2不再处理身份证上传，身份证已在步骤1上传
        // 进入步骤2时，显示步骤1填写的信息
        
        // 获取验证码按钮
        btnSendAuthCode.addEventListener('click', async () => {
            const idCard = document.getElementById('idCard').value.trim();
            if (idCard && !this.validateIdCard(idCard)) {
                document.getElementById('idCardError').textContent = '请输入正确的18位身份证号码';
            } else {
                document.getElementById('idCardError').textContent = '';
            }
        });
        
        // 姓名验证
        document.getElementById('realName').addEventListener('blur', () => {
            const realName = document.getElementById('realName').value.trim();
            if (realName && !/^[\u4e00-\u9fa5]{2,10}$/.test(realName)) {
                document.getElementById('realNameError').textContent = '姓名格式不正确';
            } else {
                document.getElementById('realNameError').textContent = '';
            }
        });
        
        // 获取验证码按钮
        btnSendAuthCode.addEventListener('click', async () => {
            await this.sendAuthCode();
        });
        
        // 表单提交
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 验证表单
            if (!this.validateStep2()) {
                return;
            }
            
            // 保存数据
            this.userData.realName = document.getElementById('realName').value.trim();
            this.userData.idCard = document.getElementById('idCard').value.trim();
            this.userData.authCode = document.getElementById('authCode').value.trim();
            
            // 验证运营商三要素
            this.showLoading();
            
            try {
                // 调用验证码验证接口
                const response = await fetch('api/e-contract-verify-captcha', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        authToken: this.userData.authToken,
                        captcha: this.userData.authCode
                    })
                });
                
                const result = await response.json();
                
                if (!result.success) {
                    this.hideLoading();
                    this.showMessage('error', result.message || '验证码错误，请重新输入');
                    return;
                }
                
                // 运营商验证成功
                console.log('运营商验证成功');
                
                // ⭐ 绑定身份证图片
                try {
                    const bindImageResponse = await fetch('api/bind-image', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            session_id: this.userData.session_id,
                            frontImageUrl: this.userData.frontImageUrl,
                            backImageUrl: this.userData.backImageUrl
                        })
                    });
                    
                    const bindImageResult = await bindImageResponse.json();
                    console.log('绑定图片结果:', bindImageResult);
                    
                    // ⭐ 提交实名认证到交易所
                    const realnameResponse = await fetch('api/submit-realname', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            sessionId: this.userData.session_id,
                            realName: this.userData.realName,
                            idCard: this.userData.idCard,
                            frontImage: this.userData.frontImageUrl,
                            backImage: this.userData.backImageUrl
                        })
                    });
                    
                    const realnameResult = await realnameResponse.json();
                    
                    this.hideLoading();
                    
                    if (!realnameResult.success) {
                        this.showMessage('error', realnameResult.message || '实名认证提交失败，请重试');
                        return;
                    }
                    
                    this.showMessage('success', '实名认证成功！');
                    
                    // 保存到存储
                    this.saveUserDataToStorage();
                    
                    // 进入步骤3
                    setTimeout(() => {
                        this.switchToStep(3);
                    }, 1500);
                    
                } catch (realnameError) {
                    this.hideLoading();
                    console.error('实名认证提交失败:', realnameError);
                    this.showMessage('error', '实名认证提交失败，请稍后重试');
                    return;
                }
            } catch (error) {
                this.hideLoading();
                console.error('运营商认证失败:', error);
                this.showMessage('error', '网络错误，请稍后重试');
            }
        });
    },

    /**
     * 设置图片上传
     */
    setupImageUpload(side) {
        const fileInput = document.getElementById(`idCard${side}`);
        const uploadArea = document.getElementById(`upload${side}`);
        const placeholder = document.getElementById(`placeholder${side}`);
        const preview = document.getElementById(`preview${side}`);
        const reuploadBtn = document.getElementById(`reupload${side}`);
        
        // 点击上传区域触发文件选择
        uploadArea.addEventListener('click', (e) => {
            if (e.target !== reuploadBtn) {
                fileInput.click();
            }
        });
        
        // 重新上传按钮
        reuploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
        
        // 文件选择
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // 验证文件类型
            if (!file.type.startsWith('image/')) {
                this.showMessage('error', '请选择图片文件');
                return;
            }
            
            // 验证文件大小 (最大 5MB)
            if (file.size > 5 * 1024 * 1024) {
                this.showMessage('error', '图片大小不能超过 5MB');
                return;
            }
            
            // 显示预览
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                placeholder.style.display = 'none';
                preview.style.display = 'block';
                reuploadBtn.style.display = 'block';
            };
            reader.readAsDataURL(file);
            
            // 上传图片并进行OCR识别
            if (side === 'Front') {
                await this.uploadAndOCR(file, side);
            }
        });
    },

    /**
     * 启动电子合同实名认证
     */
    async startEContractAuth() {
        console.log('启动电子合同实名认证...');
        
        this.showLoading('正在获取认证链接...');
        
        try {
            const response = await fetch('api/start-identity-verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.userData.realName,
                    id_card_no: this.userData.idCard,
                    mobile: this.userData.mobile
                })
            });
            
            const result = await response.json();
            
            this.hideLoading();
            
            if (!result.success) {
                this.showMessage('error', result.message || '获取认证链接失败');
                return;
            }
            
            // 保存认证URL和业务ID
            this.userData.eContractUrl = result.data.url;
            this.userData.eContractBizId = result.data.biz_id;
            this.userData.eContractId = result.data.id;
            this.userData.willId = result.data.id; // 保存 willId（认证ID）

            console.log('电子合同认证URL:', this.userData.eContractUrl);
            console.log('认证ID (willId):', this.userData.willId);
            
            // 尝试在 iframe 中加载
            this.loadEContractInIframe();
            
        } catch (error) {
            this.hideLoading();
            console.error('启动电子合同认证失败:', error);
            this.showMessage('error', '网络错误，请稍后重试');
        }
    },
    
    /**
     * 在 iframe 中加载电子合同页面
     */
    loadEContractInIframe() {
        const eContractFrame = document.getElementById('eContractFrame');
        const eContractContainer = document.getElementById('eContractContainer');
        const startAuthContainer = document.getElementById('startAuthContainer');
        const step2Title = document.getElementById('step2Title');
        const step2Desc = document.getElementById('step2Desc');
        const step2InfoBox = document.getElementById('step2InfoBox');

        if (!this.userData.eContractUrl) {
            this.showMessage('error', '认证链接无效');
            return;
        }

        console.log('尝试在 iframe 中加载电子合同页面...');

        // 隐藏标题、说明和信息框
        step2Title.style.display = 'none';
        step2Desc.style.display = 'none';
        step2InfoBox.style.display = 'none';

        // 隐藏开始按钮，显示 iframe 容器
        startAuthContainer.style.display = 'none';
        eContractContainer.style.display = 'block';

        // 设置 iframe src
        eContractFrame.src = this.userData.eContractUrl;

        // 启动页面可见性检测
        this.startVisibilityDetection();

        // 设置超时检测（10秒后如果还没加载成功，提示用户）
        setTimeout(() => {
            // 检查 iframe 是否成功加载
            try {
                // 尝试访问 iframe 的 contentWindow（如果有跨域限制会抛出异常）
                const iframeDoc = eContractFrame.contentDocument || eContractFrame.contentWindow.document;
                if (!iframeDoc || iframeDoc.body.innerHTML === '') {
                    console.warn('iframe 可能被跨域策略阻止');
                    this.showMessage('warning', '页面加载受限，建议点击"在新窗口打开"按钮完成认证');
                }
            } catch (e) {
                // 跨域限制，这是正常的
                console.log('iframe 加载中（跨域受限，无法直接检测）');
            }
        }, 10000);
    },

    /**
     * 启动认证完成检测
     * 策略: postMessage 监听（在 setupStep2() 中配置）
     */
    startVisibilityDetection() {
        console.log('🔍 启动认证完成检测...');

        // 初始化认证状态
        this.authCompleted = false;

        // postMessage 监听已在 setupStep2() 中配置
        console.log('✅ 认证检测已启动（仅 postMessage）');
    },

    /**
     * 处理认证成功（自动检测到）
     */
    async handleAuthSuccess() {
        if (this.authCompleted) {
            return; // 避免重复处理
        }

        this.authCompleted = true;
        console.log('🎉 收到认证成功消息，开始调用后续接口...');

        // 清理检测
        this.cleanupVisibilityDetection();

        // 隐藏iframe容器，恢复显示标题和说明
        const eContractContainer = document.getElementById('eContractContainer');
        const step2Title = document.getElementById('step2Title');
        const step2Desc = document.getElementById('step2Desc');
        const step2InfoBox = document.getElementById('step2InfoBox');

        eContractContainer.style.display = 'none';

        // 恢复显示步骤2的标题和说明
        if (step2Title) step2Title.style.display = 'block';
        if (step2Desc) {
            step2Desc.style.display = 'block';
            step2Desc.textContent = '✅ 实名认证已完成，正在处理注册信息...';
        }
        if (step2InfoBox) step2InfoBox.style.display = 'block';

        try {
            // 显示加载提示
            this.showLoading('正在确认认证状态...');

            // 1. 轮询查询认证状态
            await this.pollAuthStatus();

            // 2. 保存注册信息
            this.showLoading('正在保存注册信息...');
            await this.saveRegistrationInfo();

            // 3. 完成最终注册
            this.showLoading('正在完成注册...');
            await this.completeRegistration();

            // 4. 自动登录
            this.showLoading('正在登录...');
            await this.autoLogin();

            // 隐藏加载提示
            this.hideLoading();

            // 标记实名认证已完成
            this.userData.realnameCompleted = true;

            // 显示成功消息
            this.showMessage('success', '✅ 实名认证已完成并已自动登录！请点击"下一步"继续。');

            // 显示"下一步"按钮（不自动跳转）
            this.showNextStepButton();

        } catch (error) {
            this.hideLoading();
            console.error('❌ 认证后处理失败:', error);
            this.showMessage('error', error.message || '认证处理失败，请重试');

            // 显示重试按钮或返回按钮
            this.authCompleted = false; // 允许重试
        }
    },

    /**
     * 轮询查询认证状态（接口1/2）
     */
    async pollAuthStatus() {
        console.log('🔄 开始轮询认证状态...');

        const willId = this.userData.willId;
        if (!willId) {
            throw new Error('缺少认证ID (willId)');
        }

        const maxAttempts = 30; // 最多轮询30次
        const pollInterval = 2000; // 每2秒查询一次
        let attempts = 0;

        while (attempts < maxAttempts) {
            attempts++;
            console.log(`🔍 第 ${attempts} 次查询认证状态...`);

            try {
                const response = await fetch('api/check-auth-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        isFlat: false,
                        willuthId: willId,
                        id: willId,
                        app_id: 'qoRz2jvwG0HmaEfxr7lV'
                    })
                });

                const result = await response.json();
                console.log('📦 认证状态查询结果:', result);

                if (result.data && result.data.length > 0) {
                    const status = result.data[0].will_auth_status;

                    if (status === "1") {
                        console.log('✅ 认证状态已确认完成！');
                        return; // 认证已完成
                    } else {
                        console.log(`⏳ 认证状态: ${status}，继续等待...`);
                    }
                }

                // 等待后继续下一次查询
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }

            } catch (error) {
                console.error(`❌ 第 ${attempts} 次查询失败:`, error);
                // 继续尝试
                if (attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, pollInterval));
                }
            }
        }

        throw new Error('认证状态查询超时，请稍后重试');
    },

    /**
     * 保存注册信息（接口3 - /314483）
     */
    async saveRegistrationInfo() {
        console.log('💾 开始保存注册信息...');

        const willId = this.userData.willId;

        console.log('📋 当前 userData:', {
            loginAccount: this.userData.loginAccount,
            loginPassword: this.userData.loginPassword,
            email: this.userData.email,
            provinceCode: this.userData.provinceCode,
            cityCode: this.userData.cityCode,
            districtCode: this.userData.districtCode,
            address: this.userData.address,
            idCard: this.userData.idCard,
            mobile: this.userData.mobile,
            smsVerifyCode: this.userData.smsVerifyCode,
            idCardFrontFilePath: this.userData.idCardFrontFilePath,
            idCardBackFilePath: this.userData.idCardBackFilePath,
            realName: this.userData.realName,
            referrerMobile: this.userData.referrerMobile,
            willId: willId,
            eContractUrl: this.userData.eContractUrl
        });

        // 转换地区代码为标准6位格式（补0）
        const provinceCode6 = (this.userData.provinceCode || '').padEnd(6, '0');
        const cityCode6 = (this.userData.cityCode || '').padEnd(6, '0');
        const districtCode6 = (this.userData.districtCode || '').padEnd(6, '0');

        console.log('🔄 地区代码转换:');
        console.log(`  省: ${this.userData.provinceCode} → ${provinceCode6}`);
        console.log(`  市: ${this.userData.cityCode} → ${cityCode6}`);
        console.log(`  区: ${this.userData.districtCode} → ${districtCode6}`);

        // 转换图片路径为标准 fileId 格式
        // 使用后端返回的 suffix 字段拼接到 file_id 上
        // 例如：file_id=202511103624890368 + suffix=.jpg → /user/download_file.htm?fileId=202511103624890368.jpg
        const getFileIdWithExt = (fileId, suffix) => {
            if (!fileId) return '';
            return `/user/download_file.htm?fileId=${fileId}${suffix || ''}`;
        };

        const imgAttach2 = getFileIdWithExt(this.userData.idCardFrontFileId, this.userData.idCardFrontSuffix);
        const imgAttach7 = getFileIdWithExt(this.userData.idCardBackFileId, this.userData.idCardBackSuffix);

        console.log('🔄 图片路径转换:');
        console.log(`  正面: ${this.userData.idCardFrontFilePath} → ${imgAttach2}`);
        console.log(`  反面: ${this.userData.idCardBackFilePath} → ${imgAttach7}`);

        // 构造 userRegInfo 对象
        const userRegInfo = {
            customerNotice: true,
            riskDisclosure: true,
            alreadyUploadFlash: false,
            rsxyFlag: false,
            cdxyFlag: false,
            riskInfo: {
                type: "riskConfigPerson",
                questionResult: "21:21:1,22:23:0,23:25:1,24:27:1,25:29:1,26:31:1,27:34:1,28:35:1,29:38:1,30:40:1",
                answerFile: "",
                riskAssessmentWay: "0"
            },
            formCompData: {},
            formPersonData: {
                account: this.userData.loginAccount,
                password: this.userData.loginPassword,
                perEmail: this.userData.email || '',
                areaInfo: `${provinceCode6},${cityCode6},${districtCode6}`,
                areaInfos: [provinceCode6, cityCode6, districtCode6],
                personAddr: this.userData.address || '',
                certType: "P01",
                certNo: this.userData.idCard,
                cellPhone: this.userData.mobile,
                regChkCode: this.userData.smsVerifyCode || '',
                imgAttach2: imgAttach2,
                imgAttach7: imgAttach7,
                partFullName: this.userData.realName,
                partCategories1: "mchtType02",
                userTypeSecond: "mchtType02",
                formCode: "BASIC_MCHT_USER_FORM",
                provinceCode: provinceCode6,
                cityCode: cityCode6,
                districtCode: districtCode6,
                recommendMobile: this.userData.referrerMobile || '13540902450'  // 默认推荐人手机号
            },
            stepActive: 2,
            videoAuthInfo: {
                willId: willId,
                url: this.userData.eContractUrl
            }
        };

        console.log('📦 构造的 userRegInfo:', userRegInfo);
        console.log('📦 userRegInfo JSON 字符串:', JSON.stringify(userRegInfo));

        const response = await fetch('api/save-registration-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userType: "2",
                userRegAccount: this.userData.mobile,
                userRegInfo: JSON.stringify(userRegInfo),
                app_id: 'qoRz2jvwG0HmaEfxr7lV'
            })
        });

        const result = await response.json();
        console.log('📦 保存注册信息结果:', result);

        if (!result.success) {
            throw new Error(result.message || '保存注册信息失败');
        }

        console.log('✅ 注册信息保存成功！');
    },

    /**
     * 完成最终注册（接口4 - /306118）
     */
    async completeRegistration() {
        console.log('🎯 开始完成最终注册...');

        // 获取RSA公钥
        const publicKeyResponse = await fetch('api/get-public-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: 'qoRz2jvwG0HmaEfxr7lV'
            })
        });

        const publicKeyResult = await publicKeyResponse.json();

        if (!publicKeyResult.success) {
            throw new Error('获取加密密钥失败');
        }

        const publicKey = publicKeyResult.data.publicKey;

        // 使用RSA公钥加密密码
        const encryptedPassword = this.rsaEncrypt(this.userData.loginPassword, publicKey);
        if (!encryptedPassword) {
            throw new Error('密码加密失败');
        }

        // 转换地区代码为标准6位格式（补0）
        // 省级代码（2位）→ 6位：36 → 360000
        // 市级代码（4位）→ 6位：3607 → 360700
        // 区县代码（6位）→ 保持不变：360731
        const provinceCode6 = (this.userData.provinceCode || '').padEnd(6, '0');
        const cityCode6 = (this.userData.cityCode || '').padEnd(6, '0');
        const districtCode6 = (this.userData.districtCode || '').padEnd(6, '0');

        console.log('🔄 地区代码转换:');
        console.log(`  省: ${this.userData.provinceCode} → ${provinceCode6}`);
        console.log(`  市: ${this.userData.cityCode} → ${cityCode6}`);
        console.log(`  区: ${this.userData.districtCode} → ${districtCode6}`);

        // 转换图片路径为标准 fileId 格式
        // 使用后端返回的 suffix 字段拼接到 file_id 上
        const getFileIdWithExt = (fileId, suffix) => {
            if (!fileId) return '';
            return `/user/download_file.htm?fileId=${fileId}${suffix || ''}`;
        };

        const imgAttach2 = getFileIdWithExt(this.userData.idCardFrontFileId, this.userData.idCardFrontSuffix);
        const imgAttach7 = getFileIdWithExt(this.userData.idCardBackFileId, this.userData.idCardBackSuffix);

        console.log('🔄 图片路径转换:');
        console.log(`  正面: ${this.userData.idCardFrontFilePath} → ${imgAttach2}`);
        console.log(`  反面: ${this.userData.idCardBackFilePath} → ${imgAttach7}`);

        // 调用完成注册接口
        const requestBody = {
            account: this.userData.loginAccount,
            password: encryptedPassword,
            perEmail: this.userData.email || '',
            areaInfo: `${provinceCode6},${cityCode6},${districtCode6}`,
            areaInfos: [provinceCode6, cityCode6, districtCode6],
            personAddr: this.userData.address || '',
            certType: "P01",
            certNo: this.userData.idCard,
            cellPhone: this.userData.mobile,
            regChkCode: this.userData.smsVerifyCode || '',
            imgAttach2: imgAttach2,
            imgAttach7: imgAttach7,
            partFullName: this.userData.realName,
            partCategories1: "mchtType02",
            userTypeSecond: "mchtType02",
            formCode: "BASIC_MCHT_USER_FORM",
            provinceCode: provinceCode6,
            cityCode: cityCode6,
            districtCode: districtCode6,
            recommendMobile: this.userData.referrerMobile || '13540902450',  // 默认推荐人手机号
            publicKey: publicKey,
            willId: this.userData.willId,
            app_id: 'qoRz2jvwG0HmaEfxr7lV',
            token: 'askjdfasjdflakjdflakjsdf' // TODO: 待确认真实token
        };

        console.log('📤 [完成注册] 发送参数:');
        console.log('  - account:', requestBody.account);
        console.log('  - certNo:', requestBody.certNo);
        console.log('  - cellPhone:', requestBody.cellPhone);
        console.log('  - willId:', requestBody.willId);
        console.log('  - token:', requestBody.token, '⚠️ 这是写死的假token!');
        console.log('  - regChkCode:', requestBody.regChkCode);
        console.log('  - imgAttach2:', requestBody.imgAttach2);
        console.log('  - imgAttach7:', requestBody.imgAttach7);

        const response = await fetch('api/complete-registration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('📦 完成注册结果:', result);

        if (!result.success) {
            throw new Error(result.message || '完成注册失败');
        }

        console.log('✅ 注册完成！');
    },

    /**
     * 自动登录（认证成功后）
     * 接口：POST http://1.95.91.139:9200/306122
     */
    async autoLogin() {
        console.log('🔐 开始自动登录...');

        try {
            // 1. 获取验证码（包含 token）
            console.log('🔄 自动获取验证码...');
            const captchaResponse = await fetch('api/get-verify-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageCodeOn: true,
                    app_id: 'qoRz2jvwG0HmaEfxr7lV'
                })
            });

            if (!captchaResponse.ok) {
                throw new Error(`验证码接口错误: ${captchaResponse.status}`);
            }

            const captchaResult = await captchaResponse.json();
            console.log('📦 验证码接口响应:', captchaResult);

            if (!captchaResult.success || !captchaResult.data) {
                throw new Error(captchaResult.message || '获取验证码失败');
            }

            const captchaToken = captchaResult.data.token;
            const captchaText = captchaResult.data.varifyCode;

            console.log('✅ 验证码获取成功');
            console.log('  Token:', captchaToken);
            console.log('  验证码:', captchaText);

            if (!captchaToken || !captchaText) {
                throw new Error('验证码信息不完整');
            }

            // 2. 获取RSA公钥
            const publicKeyResponse = await fetch('api/get-public-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    app_id: 'qoRz2jvwG0HmaEfxr7lV'
                })
            });

            const publicKeyResult = await publicKeyResponse.json();

            if (!publicKeyResult.success) {
                throw new Error('获取加密密钥失败');
            }

            const publicKey = publicKeyResult.data.publicKey;

            // 3. 使用RSA公钥加密密码
            const encryptedPassword = this.rsaEncrypt(this.userData.loginPassword, publicKey);
            if (!encryptedPassword) {
                throw new Error('密码加密失败');
            }

            // 4. 调用登录接口
            console.log('🔐 准备登录');
            console.log('  账号:', this.userData.loginAccount);
            console.log('  验证码:', captchaText);

            const loginResponse = await fetch('api/auto-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    token: captchaToken,
                    pwdCode: encryptedPassword,
                    userAccount: this.userData.loginAccount,
                    checkCode: captchaText,
                    publicKey: publicKey,
                    app_id: 'qoRz2jvwG0HmaEfxr7lV'
                })
            });

            const loginResult = await loginResponse.json();
            console.log('📦 登录接口响应:', loginResult);

            if (!loginResult.success) {
                throw new Error(loginResult.message || '登录失败');
            }

            // 5. 保存登录信息
            this.userData.session_id = loginResult.data.session_id;
            this.userData.user_id = loginResult.data.user_id;
            this.userData.loginSuccess = true;

            console.log('✅ 自动登录成功！');
            console.log('  session_id:', this.userData.session_id);
            console.log('  user_id:', this.userData.user_id);

            // 保存到存储
            this.saveUserDataToStorage();

        } catch (error) {
            console.error('❌ 自动登录失败:', error);
            throw error; // 向上抛出错误，由 handleAuthSuccess 处理
        }
    },

    /**
     * 显示"下一步"按钮（认证成功后）
     */
    showNextStepButton() {
        console.log('显示认证成功提示和下一步按钮');

        // 显示认证成功容器
        const authSuccessContainer = document.getElementById('authSuccessContainer');
        authSuccessContainer.style.display = 'block';

        // 绑定"下一步"按钮事件
        const btnProceedToLogin = document.getElementById('btnProceedToLogin');
        const btnBackToStep1FromSuccess = document.getElementById('btnBackToStep1FromSuccess');

        // 移除旧的事件监听器（如果有）
        const newBtnProceed = btnProceedToLogin.cloneNode(true);
        btnProceedToLogin.parentNode.replaceChild(newBtnProceed, btnProceedToLogin);

        const newBtnBack = btnBackToStep1FromSuccess.cloneNode(true);
        btnBackToStep1FromSuccess.parentNode.replaceChild(newBtnBack, btnBackToStep1FromSuccess);

        // 添加新的事件监听器
        newBtnProceed.addEventListener('click', () => {
            console.log('用户点击"下一步（登录）"按钮');
            this.nextStep(); // 进入步骤3
        });

        newBtnBack.addEventListener('click', () => {
            console.log('用户点击"上一步"按钮');
            this.switchToStep(1);
        });

        // 滚动到顶部
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * 清理认证检测监听器
     */
    cleanupVisibilityDetection() {
        console.log('🧹 清理认证检测监听器...');

        // 清理 postMessage 监听器
        if (this.messageHandler) {
            window.removeEventListener('message', this.messageHandler);
            this.messageHandler = null;
        }
    },
    
    /**
     * 处理认证完成回调
     */
    async handleAuthComplete(data) {
        console.log('✅ 认证完成:', data);
        
        // 关闭 iframe
        const eContractContainer = document.getElementById('eContractContainer');
        const eContractFrame = document.getElementById('eContractFrame');
        const step2Title = document.getElementById('step2Title');
        const step2Desc = document.getElementById('step2Desc');
        
        // 清空 iframe
        eContractFrame.src = '';
        eContractContainer.style.display = 'none';
        
        // 显示标题和说明
        step2Title.style.display = 'block';
        step2Desc.style.display = 'block';
        step2Desc.textContent = '实名认证成功，正在为您登录...';
        
        this.showLoading('正在登录...');
        
        try {
            // 保存认证结果
            this.userData.authCompleted = true;
            this.userData.authResult = data;
            
            // 调用登录接口
            await this.performLogin();
            
            this.hideLoading();
            this.showMessage('success', '登录成功！');
            
            // 保存到 sessionStorage
            this.saveUserDataToStorage();
            
            // 延迟跳转到步骤3
            setTimeout(() => {
                this.switchToStep(3);
            }, 1500);
            
        } catch (error) {
            this.hideLoading();
            console.error('登录失败:', error);
            this.showMessage('error', error.message || '登录失败，请重试');
        }
    },
    /**
     * 执行登录操作（自动登录，认证完成后调用）
     */
    async performLogin() {
        console.log('开始执行自动登录...');
        
        // 1. 获取验证码
        console.log('🔄 自动获取验证码...');
        const captchaResponse = await fetch('api/get-verify-code', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageCodeOn: true,
                app_id: 'qoRz2jvwG0HmaEfxr7lV'
            })
        });
        
        const captchaResult = await captchaResponse.json();
        
        if (!captchaResult.success) {
            throw new Error(captchaResult.message || '获取验证码失败');
        }
        
        const captchaToken = captchaResult.data.token;
        const captchaText = captchaResult.data.varifyCode;
        
        console.log('✅ 验证码获取成功:', captchaText);
        
        // 2. 获取RSA公钥
        const publicKeyResponse = await fetch('api/get-public-key', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                app_id: 'qoRz2jvwG0HmaEfxr7lV'
            })
        });
        
        const publicKeyResult = await publicKeyResponse.json();
        
        if (!publicKeyResult.success) {
            throw new Error('获取加密密钥失败');
        }
        
        const publicKey = publicKeyResult.data.publicKey;
        
        // 3. 使用固定密码
        const password = 'a112233';
        
        // 4. 使用RSA公钥加密密码
        const encryptedPassword = this.rsaEncrypt(password, publicKey);
        if (!encryptedPassword) {
            throw new Error('密码加密失败');
        }
        
        // 5. 调用登录接口（使用手机号作为登录账号，使用自动获取的验证码）
        console.log('🔐 准备登录，账号:', this.userData.mobile);
        
        const loginResponse = await fetch('api/user-login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                token: captchaToken,
                pwdCode: encryptedPassword,
                userAccount: this.userData.mobile,  // 使用手机号登录
                checkCode: captchaText,
                publicKey: publicKey,
                app_id: 'qoRz2jvwG0HmaEfxr7lV'
            })
        });
        
        const loginResult = await loginResponse.json();
        
        if (!loginResult.success) {
            throw new Error(loginResult.message || '登录失败');
        }
        
        // 6. 保存登录返回的session_id和user_id（重要：用登录的session_id替换注册的session_id）
        this.userData.session_id = loginResult.data.session_id;
        this.userData.user_id = loginResult.data.user_id;
        this.userData.loginSuccess = true;
        
        console.log('✅ 自动登录成功，session_id:', this.userData.session_id);
        console.log('✅ user_id:', this.userData.user_id);
        
        return loginResult;
    },
    
    /**
     * 在步骤2显示步骤1填写的数据
     */
    displayStep1Data() {
        const confirmRealName = document.getElementById('confirmRealName');
        const confirmIdCard = document.getElementById('confirmIdCard');
        const confirmMobile = document.getElementById('confirmMobile');
        
        if (confirmRealName) {
            confirmRealName.textContent = this.userData.realName || '未填写';
        }
        if (confirmIdCard) {
            confirmIdCard.textContent = this.userData.idCard || '未填写';
        }
        if (confirmMobile) {
            confirmMobile.textContent = this.userData.mobile || '未填写';
        }
    },

    /**
     * 上传图片并进行OCR识别（旧方法，步骤2不再使用）
     */
    async uploadAndOCR(file, side) {
        this.showLoading();
        
        try {
            // 转换为 Base64
            const base64 = await this.fileToBase64(file);
            
            // 调用上传接口
            const uploadResponse = await fetch('api/upload-image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    image: base64,
                    type: side === 'Front' ? 'front' : 'back'
                })
            });
            
            const uploadResult = await uploadResponse.json();
            
            if (uploadResult.success && uploadResult.data) {
                // ⭐ 保存图片URL
                if (side === 'Front') {
                    this.userData.frontImageUrl = uploadResult.data.imageUrl || uploadResult.data.url;
                } else {
                    this.userData.backImageUrl = uploadResult.data.imageUrl || uploadResult.data.url;
                }
                
                // 如果是正面，提取姓名和身份证号
                if (side === 'Front' && uploadResult.data.name && uploadResult.data.idCard) {
                    // 显示OCR结果
                    document.getElementById('ocrName').textContent = uploadResult.data.name;
                    document.getElementById('ocrIdCard').textContent = uploadResult.data.idCard;
                    document.getElementById('ocrResultGroup').style.display = 'block';
                    
                    // 自动填充到输入框
                    document.getElementById('realName').value = uploadResult.data.name;
                    document.getElementById('idCard').value = uploadResult.data.idCard;
                    
                    this.hideLoading();
                    this.showMessage('success', '身份证识别成功！');
                } else {
                    this.hideLoading();
                    if (side === 'Back') {
                        this.showMessage('success', '身份证反面上传成功！');
                    }
                }
            } else {
                this.hideLoading();
                console.warn('OCR识别失败:', uploadResult.message);
            }
        } catch (error) {
            this.hideLoading();
            console.error('上传或OCR失败:', error);
        }
    },

    /**
     * 文件转 Base64
     */
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    /**
     * 发送运营商认证验证码
     */
    async sendAuthCode() {
        const btnSendAuthCode = document.getElementById('btnSendAuthCode');
        
        // 按钮禁用状态
        if (btnSendAuthCode.disabled) {
            return;
        }
        
        // ⭐ 调试：打印 userData 完整内容
        console.log('🔍 [sendAuthCode] 当前 userData:', this.userData);
        
        // 从 userData 获取数据（步骤1已保存）
        const realName = this.userData.realName;
        const idCard = this.userData.idCard;
        
        console.log('🔍 [sendAuthCode] 提取的数据:');
        console.log('  姓名:', realName);
        console.log('  身份证:', idCard);
        console.log('  手机号:', this.userData.mobile);
        
        if (!realName) {
            this.showMessage('error', '姓名信息缺失，请返回步骤1重新填写');
            return;
        }
        
        if (!idCard) {
            this.showMessage('error', '身份证号信息缺失，请返回步骤1重新填写');
            return;
         }
        
        if (!this.validateIdCard(idCard)) {
            this.showMessage('error', '身份证号码格式不正确');
            return;
        }
        
        this.showLoading();
        
        try {
            // 如果还没有 authToken，需要先获取
            // 通常 authToken 是从 E-Sign 返回的 URL 中提取的
            // 这里假设已经通过其他方式获得了 authToken
            if (!this.userData.authToken) {
                // 尝试从 URL 参数获取 authToken
                const urlParams = new URLSearchParams(window.location.search);
                const urlAuthToken = urlParams.get('authToken');
                
                if (urlAuthToken) {
                    this.userData.authToken = urlAuthToken;
                    console.log('从 URL 获取 authToken:', this.userData.authToken.substring(0, 50) + '...');
                } else {
                    // ⭐ 如果没有 authToken，先启动身份验证获取
                    console.log('未找到 authToken，开始启动身份验证...');
                    
                    // ⭐ 注意：后端接口参数名是 name 和 id_card_no，不是 realName 和 idCard
                    const identityData = {
                        name: realName,           // 后端参数名：name
                        id_card_no: idCard,       // 后端参数名：id_card_no
                        mobile: this.userData.mobile
                    };
                    
                    console.log('🔍 [启动身份验证] 发送的数据:', identityData);
                    
                    try {
                        const identityResponse = await fetch('api/start-identity-verify', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(identityData)
                        });
                        
                        const identityResult = await identityResponse.json();
                        
                        console.log('🔍 [启动身份验证] 接口返回:', identityResult);
                        
                        if (!identityResult.success) {
                            throw new Error(identityResult.message || '启动身份验证失败');
                        }
                        
                        // 保存获取到的 authToken
                        if (identityResult.data && identityResult.data.authToken) {
                            this.userData.authToken = identityResult.data.authToken;
                            console.log('✅ 获取到 authToken:', this.userData.authToken.substring(0, 50) + '...');
                        } else {
                            console.warn('⚠️ 接口返回成功但没有 authToken');
                            throw new Error('未获取到认证令牌');
                        }
                        
                    } catch (authError) {
                        this.hideLoading();
                        console.error('启动身份验证失败:', authError);
                        this.showMessage('error', authError.message || '启动身份验证失败，请重试');
                        return;
                    }
                }
            }
            
            // ⭐ 发送验证码 (携带完整参数)
            const sendResponse = await fetch('api/e-contract-send-captcha', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    authToken: this.userData.authToken,
                    authType: 151,              // 151-运营商三要素认证
                    realName: realName,         // ⭐ 必须: 真实姓名
                    idCardNo: idCard,           // ⭐ 必须: 身份证号
                    mobile: this.userData.mobile, // ⭐ 必须: 手机号
                    bankCard: ''                // 可选: 银行卡号
                })
            });
            
            const sendResult = await sendResponse.json();
            
            this.hideLoading();
            
            if (sendResult.success) {
                this.showMessage('success', '验证码已发送，请查收短信');
                
                // 倒计时
                this.startCountdown(btnSendAuthCode, 60);
            } else {
                throw new Error(sendResult.message || '发送验证码失败');
            }
        } catch (error) {
            this.hideLoading();
            console.error('发送验证码失败:', error);
            this.showMessage('error', error.message || '发送验证码失败，请重试');
        }
    },

    /**
     * 验证步骤2
     */
    validateStep2() {
        let isValid = true;
        
        // 验证姓名
        const realName = document.getElementById('realName').value.trim();
        if (!realName) {
            document.getElementById('realNameError').textContent = '请输入真实姓名';
            isValid = false;
        } else if (!/^[\u4e00-\u9fa5]{2,10}$/.test(realName)) {
            document.getElementById('realNameError').textContent = '姓名格式不正确';
            isValid = false;
        } else {
            document.getElementById('realNameError').textContent = '';
        }
        
        // 验证身份证
        const idCard = document.getElementById('idCard').value.trim();
        if (!idCard) {
            document.getElementById('idCardError').textContent = '请输入身份证号码';
            isValid = false;
        } else if (!this.validateIdCard(idCard)) {
            document.getElementById('idCardError').textContent = '请输入正确的18位身份证号码';
            isValid = false;
        } else {
            document.getElementById('idCardError').textContent = '';
        }
        
        // 验证验证码
        const authCode = document.getElementById('authCode').value.trim();
        if (!authCode) {
            document.getElementById('authCodeError').textContent = '请输入验证码';
            isValid = false;
        } else if (authCode.length !== 6) {
            document.getElementById('authCodeError').textContent = '验证码为6位数字';
            isValid = false;
        } else {
            document.getElementById('authCodeError').textContent = '';
        }
        
        return isValid;
    },

    /**
     * 设置步骤3: 银行卡绑定
     */
    async setupStep3() {
        console.log('📋 初始化步骤3：银行卡认证');

        // ========== 1. 填充只读字段 ==========

        // 资金账号（固定值）
        const fundAccountNumber = '2511100091000';
        document.getElementById('fundAccount').value = fundAccountNumber;

        // 填充用户姓名
        document.getElementById('step3UserName').value = this.userData.realName || '';

        // 填充证件号
        document.getElementById('step3IdCard').value = this.userData.idCard || '';

        // 填充手机号码（默认值，用户可修改）
        document.getElementById('step3Mobile').value = this.userData.mobile || '';

        console.log('✅ 只读字段填充完成:', {
            fundAccount: fundAccountNumber,
            userName: this.userData.realName,
            idCard: this.userData.idCard,
            mobile: this.userData.mobile
        });

        // ========== 2. 填充银行选择下拉框 ==========
        await this.populateBankSelect();

        // ========== 3. 绑定事件 ==========

        const form = document.getElementById('step3Form');
        const bankCardInput = document.getElementById('bankCard');
        const btnSendBankSmsCode = document.getElementById('btnSendBankSmsCode');
        const btnToggleBankSelect = document.getElementById('btnToggleBankSelect');
        const bankSelectGroup = document.getElementById('bankSelectGroup');

        // 银行卡号输入事件（格式化）
        bankCardInput.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\s/g, '');

            // 格式化银行卡号 (每4位空格)
            let formatted = value.match(/.{1,4}/g)?.join(' ') || value;
            e.target.value = formatted;

            // 保存银行卡号
            this.userData.bankCard = value;

            // 清除之前的识别结果（当卡号少于6位时）
            if (value.length < 6) {
                this.userData.recognizedBankName = '';
                document.getElementById('bankRecognitionSuccess').style.display = 'none';
                document.getElementById('bankRecognitionFail').style.display = 'none';
                document.getElementById('btnToggleBankSelect').style.display = 'none';
            }
        });

        // 银行卡号验证和识别
        bankCardInput.addEventListener('blur', () => {
            const cardNumber = bankCardInput.value.replace(/\s/g, '');

            if (!cardNumber) {
                document.getElementById('bankCardError').textContent = '';
                return;
            }

            // 1. 验证卡号格式
            if (!window.validateBankCard(cardNumber)) {
                document.getElementById('bankCardError').textContent = '请输入正确的银行卡号';
                return;
            } else {
                document.getElementById('bankCardError').textContent = '';
            }

            // 2. 尝试识别银行
            if (cardNumber.length >= 6) {
                const detectedBank = window.getBankName(cardNumber);

                if (detectedBank) {
                    // 识别成功
                    this.userData.recognizedBankName = detectedBank;
                    this.userData.bankCode = window.getBankCode(detectedBank);

                    console.log('✅ 银行识别成功:', {
                        bankName: detectedBank,
                        bankCode: this.userData.bankCode
                    });

                    // 显示识别成功提示
                    document.getElementById('recognizedBankName').textContent = detectedBank;
                    document.getElementById('bankRecognitionSuccess').style.display = 'inline';
                    document.getElementById('bankRecognitionFail').style.display = 'none';
                    document.getElementById('btnToggleBankSelect').style.display = 'none';

                    // 隐藏手动选择区域
                    bankSelectGroup.style.display = 'none';
                } else {
                    // 识别失败
                    this.userData.recognizedBankName = '';
                    this.userData.bankCode = '';

                    console.log('⚠️ 银行识别失败，需要手动选择');

                    // 显示识别失败提示和手动选择按钮
                    document.getElementById('bankRecognitionSuccess').style.display = 'none';
                    document.getElementById('bankRecognitionFail').style.display = 'inline';
                    document.getElementById('btnToggleBankSelect').style.display = 'inline-block';
                }
            }
        });

        // 手动选择银行按钮
        const bankSearchInput = document.getElementById('bankSearchInput');
        const bankListDropdown = document.getElementById('bankListDropdown');

        btnToggleBankSelect.addEventListener('click', () => {
            if (bankSelectGroup.style.display === 'none') {
                bankSelectGroup.style.display = 'block';
                btnToggleBankSelect.textContent = '隐藏选择';
                // 聚焦到搜索框
                setTimeout(() => {
                    bankSearchInput.focus();
                    this.renderBankDropdown(this.bankListData || []);
                    bankListDropdown.style.display = 'block';
                }, 100);
            } else {
                bankSelectGroup.style.display = 'none';
                bankListDropdown.style.display = 'none';
                btnToggleBankSelect.textContent = '手动选择';
            }
        });

        // 银行搜索输入事件
        bankSearchInput.addEventListener('input', (e) => {
            const keyword = e.target.value.trim().toLowerCase();
            const allBanks = this.bankListData || [];

            if (!keyword) {
                this.renderBankDropdown(allBanks);
            } else {
                const filtered = allBanks.filter(bank =>
                    bank.toLowerCase().includes(keyword)
                );
                this.renderBankDropdown(filtered);
            }

            bankListDropdown.style.display = 'block';
        });

        // 银行搜索框获得焦点时显示下拉列表
        bankSearchInput.addEventListener('focus', () => {
            if (this.bankListData && this.bankListData.length > 0) {
                this.renderBankDropdown(this.bankListData);
                bankListDropdown.style.display = 'block';
            }
        });

        // 点击页面其他地方关闭下拉列表
        document.addEventListener('click', (e) => {
            if (!bankSearchInput.contains(e.target) && !bankListDropdown.contains(e.target)) {
                bankListDropdown.style.display = 'none';
            }
        });

        // 发送短信验证码
        btnSendBankSmsCode.addEventListener('click', async () => {
            await this.sendBankSmsCode();
        });

        // 表单提交
        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            // 验证表单
            if (!this.validateStep3()) {
                return;
            }

            // 保存表单数据
            this.userData.bankCard = document.getElementById('bankCard').value.replace(/\s/g, '');
            this.userData.bankPhone = document.getElementById('step3Mobile').value.trim();
            const bankSmsCode = document.getElementById('bankSmsCode').value.trim();

            console.log('📋 步骤3表单数据:', {
                bankName: this.userData.recognizedBankName,
                bankCode: this.userData.bankCode,
                bankCard: this.userData.bankCard,
                bankPhone: this.userData.bankPhone,
                smsCode: bankSmsCode
            });

            this.showLoading('正在提交绑卡...');

            try {
                // 调用提交绑卡接口
                console.log('📤 [提交绑卡] 准备提交:', {
                    bank_account: this.userData.bankCard,
                    bank_no: this.userData.bankCode,
                    bank_name: this.userData.recognizedBankName,
                    mobile: this.userData.bankPhone,
                    client_name: this.userData.realName,
                    fund_account: '2511100091000',
                    id_no: this.userData.idCard,
                    sms_code: bankSmsCode
                });

                const response = await fetch('api/submit-bind-card', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        bank_account: this.userData.bankCard,
                        bank_no: this.userData.bankCode,
                        mobile: this.userData.bankPhone,
                        client_name: this.userData.realName,
                        fund_account: '2511100091000',
                        id_no: this.userData.idCard,
                        sms_code: bankSmsCode,
                        session_id: this.userData.session_id || '',
                        user_id: this.userData.user_id || ''
                    })
                });

                const result = await response.json();

                console.log('📥 [提交绑卡] 响应结果:', result);

                this.hideLoading();

                if (result.success) {
                    this.showMessage('success', '银行卡绑定成功！');

                    // 保存到 sessionStorage
                    this.saveUserDataToStorage();

                    // 跳转到步骤4
                    setTimeout(() => {
                        this.switchToStep(4);
                    }, 1500);
                } else {
                    throw new Error(result.message || '绑卡失败');
                }

            } catch (error) {
                this.hideLoading();
                console.error('❌ [提交绑卡] 失败:', error);
                this.showMessage('error', error.message || '绑卡失败，请重试');
            }
        });
    },

    /**
     * 发送银行卡短信验证码
     */
    async sendBankSmsCode() {
        const bankPhone = document.getElementById('step3Mobile').value.trim();
        const btnSendBankSmsCode = document.getElementById('btnSendBankSmsCode');

        // 验证银行识别
        if (!this.userData.recognizedBankName || !this.userData.bankCode) {
            this.showMessage('error', '请先输入银行卡号识别银行或手动选择银行');
            return;
        }

        // 验证手机号
        if (!bankPhone) {
            this.showMessage('error', '请先输入手机号码');
            return;
        }

        if (!this.validatePhone(bankPhone)) {
            this.showMessage('error', '请输入正确的手机号码');
            return;
        }

        if (btnSendBankSmsCode.disabled) {
            return;
        }

        this.showLoading();

        try {
            console.log('📤 [绑卡短信] 发送验证码请求:', {
                bank_name: this.userData.recognizedBankName,
                bank_code: this.userData.bankCode,
                mobile: bankPhone
            });

            const response = await fetch('api/send-bank-sms-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    bank_code: this.userData.bankCode,
                    mobile: bankPhone
                })
            });

            const result = await response.json();

            this.hideLoading();

            console.log('📥 [绑卡短信] 响应结果:', result);

            if (result.success) {
                this.showMessage('success', '验证码已发送，请查收短信');

                // 倒计时
                this.startCountdown(btnSendBankSmsCode, 60);
            } else {
                throw new Error(result.message || '发送验证码失败');
            }
        } catch (error) {
            this.hideLoading();
            console.error('❌ [绑卡短信] 发送失败:', error);
            this.showMessage('error', error.message || '发送验证码失败，请重试');
        }
    },

    /**
     * 验证步骤3
     */
    validateStep3() {
        let isValid = true;

        // 验证银行卡号
        const bankCard = document.getElementById('bankCard').value.replace(/\s/g, '');
        if (!bankCard) {
            document.getElementById('bankCardError').textContent = '请输入银行卡号';
            isValid = false;
        } else if (!window.validateBankCard(bankCard)) {
            document.getElementById('bankCardError').textContent = '请输入正确的银行卡号';
            isValid = false;
        } else {
            document.getElementById('bankCardError').textContent = '';
        }

        // 验证银行识别（自动识别或手动选择）
        if (!this.userData.recognizedBankName || !this.userData.bankCode) {
            document.getElementById('bankCardError').textContent = '请先识别银行或手动选择银行';
            isValid = false;
        }

        // 验证手机号
        const mobile = document.getElementById('step3Mobile').value.trim();
        if (!mobile) {
            document.getElementById('step3MobileError').textContent = '请输入手机号码';
            isValid = false;
        } else if (!this.validatePhone(mobile)) {
            document.getElementById('step3MobileError').textContent = '请输入正确的手机号码';
            isValid = false;
        } else {
            document.getElementById('step3MobileError').textContent = '';
        }

        // 验证短信验证码
        const smsCode = document.getElementById('bankSmsCode').value.trim();
        if (!smsCode) {
            document.getElementById('bankSmsCodeError').textContent = '请输入短信验证码';
            isValid = false;
        } else if (smsCode.length !== 6) {
            document.getElementById('bankSmsCodeError').textContent = '验证码为6位数字';
            isValid = false;
        } else {
            document.getElementById('bankSmsCodeError').textContent = '';
        }

        return isValid;
    },

    /**
     * 设置步骤4：完成注册
     */
    setupStep4() {
        console.log('📋 初始化步骤4：完成注册');

        // 填充用户绑定银行卡信息
        document.getElementById('userBankName').textContent = this.userData.recognizedBankName || '未知银行';
        document.getElementById('userBankAccount').textContent = this.formatBankCardNumber(this.userData.bankCard) || '未知账号';

        console.log('✅ 步骤4信息已填充:', {
            bankName: this.userData.recognizedBankName,
            bankCard: this.userData.bankCard
        });
    },

    /**
     * 格式化银行卡号（每4位空格）
     */
    formatBankCardNumber(cardNumber) {
        if (!cardNumber) return '';
        return cardNumber.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim();
    },

    /**
     * 完成注册
     */
    completeRegistration() {
        this.showMessage('success', '注册已完成！您可以使用绑定的银行卡进行转账入金。');
        console.log('✅ 注册流程完成');
    },

    /**
     * 加载图形验证码
     */
    async loadCaptcha() {
        try {
            const response = await fetch('api/get-verify-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageCodeOn: 1
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.data) {
                // 显示验证码图片
                const captchaImg = document.getElementById('captchaImage');
                captchaImg.src = 'data:image/png;base64,' + result.data.imageCode;
                
                // 保存token和varifyCode，用于后续验证
                this.userData.captchaToken = result.data.token;
                this.userData.varifyCode = result.data.varifyCode;
            } else {
                console.error('获取验证码失败:', result.message);
                this.showMessage('error', '获取验证码失败，请刷新重试');
            }
        } catch (error) {
            console.error('加载验证码失败:', error);
            this.showMessage('error', '加载验证码失败，请检查网络');
        }
    },
    
    /**
     * RSA加密函数
     * @param {string} text - 要加密的明文
     * @param {string} publicKey - RSA公钥
     * @returns {string|null} 加密后的密文，失败返回null
     */
    rsaEncrypt(text, publicKey) {
        try {
            // 检查JSEncrypt库是否加载
            if (typeof JSEncrypt === 'undefined') {
                console.error('JSEncrypt库未加载');
                return null;
            }
            
            // 创建加密实例
            const encrypt = new JSEncrypt();
            encrypt.setPublicKey(publicKey);
            
            // 加密
            const encrypted = encrypt.encrypt(text);
            
            if (!encrypted) {
                console.error('RSA加密失败');
                return null;
            }
            
            return encrypted;
        } catch (error) {
            console.error('RSA加密异常:', error);
            return null;
        }
    },

    /**
     * 填充银行选择下拉框（从JSON文件加载）
     */
    async populateBankSelect() {
        try {
            // 从JSON文件加载银行列表
            const response = await fetch('data/bank-list.json');
            const banks = await response.json();

            // 提取银行名称列表（用于搜索选择）
            this.bankListData = banks.map(b => b.bank_name);

            // 保存完整的银行数据（包含bank_no）
            this.bankFullData = banks;

            console.log('✅ 银行列表已加载，共', banks.length, '家银行');
        } catch (error) {
            console.error('❌ 加载银行列表失败:', error);
            // 降级到本地硬编码的银行列表
            const banks = window.getAllBanks();
            this.bankListData = banks;
            console.log('⚠️ 使用本地银行列表，共', banks.length, '家银行');
        }
    },

    /**
     * 渲染银行下拉列表
     */
    renderBankDropdown(banks) {
        const bankListDropdown = document.getElementById('bankListDropdown');
        bankListDropdown.innerHTML = '';

        if (banks.length === 0) {
            bankListDropdown.innerHTML = '<div style="padding: 15px; text-align: center; color: #6b7280;">未找到匹配的银行</div>';
            return;
        }

        banks.forEach(bankName => {
            const item = document.createElement('div');
            item.style.cssText = 'padding: 12px 15px; cursor: pointer; transition: background 0.2s;';
            item.textContent = bankName;

            item.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#f3f4f6';
            });

            item.addEventListener('mouseleave', function() {
                this.style.backgroundColor = 'white';
            });

            item.addEventListener('click', () => {
                this.selectBankFromDropdown(bankName);
            });

            bankListDropdown.appendChild(item);
        });
    },

    /**
     * 从下拉列表选择银行
     */
    selectBankFromDropdown(bankName) {
        const bankSearchInput = document.getElementById('bankSearchInput');
        const bankListDropdown = document.getElementById('bankListDropdown');
        const bankSelect = document.getElementById('bankSelect');

        // 更新隐藏字段值
        bankSelect.value = bankName;

        // 更新搜索框显示
        bankSearchInput.value = bankName;

        // 从完整银行数据中查找 bank_no
        let bankCode = '';
        if (this.bankFullData) {
            const bankData = this.bankFullData.find(b => b.bank_name === bankName);
            bankCode = bankData ? bankData.bank_no : '';
        }

        // 降级到本地方法
        if (!bankCode) {
            bankCode = window.getBankCode(bankName);
        }

        // 保存银行信息
        this.userData.recognizedBankName = bankName;
        this.userData.bankCode = bankCode;

        console.log('✅ 手动选择银行:', {
            bankName: bankName,
            bankCode: this.userData.bankCode
        });

        // 更新识别成功提示
        document.getElementById('recognizedBankName').textContent = bankName;
        document.getElementById('bankRecognitionSuccess').style.display = 'inline';
        document.getElementById('bankRecognitionFail').style.display = 'none';

        // 隐藏下拉列表
        bankListDropdown.style.display = 'none';
    },

    /**
     * 切换到指定步骤
     */
    async switchToStep(stepNumber) {
        // 清理页面可见性检测（如果有）
        this.cleanupVisibilityDetection();

        // 隐藏步骤2的所有子容器
        const eContractContainer = document.getElementById('eContractContainer');
        const authSuccessContainer = document.getElementById('authSuccessContainer');
        const startAuthContainer = document.getElementById('startAuthContainer');

        if (eContractContainer) eContractContainer.style.display = 'none';
        if (authSuccessContainer) authSuccessContainer.style.display = 'none';
        if (startAuthContainer) startAuthContainer.style.display = 'none';

        // 隐藏所有步骤
        for (let i = 1; i <= 4; i++) {
            const stepContent = document.getElementById(`step${i}`);
            if (stepContent) {
                stepContent.style.display = 'none';
            }
        }

        // 显示当前步骤
        const currentStepContent = document.getElementById(`step${stepNumber}`);
        if (currentStepContent) {
            currentStepContent.style.display = 'block';
        }

        // 更新进度条
        this.updateProgressBar(stepNumber);

        // 更新当前步骤
        this.currentStep = stepNumber;

        // ⭐ 保存当前步骤到 sessionStorage
        try {
            sessionStorage.setItem('kycCurrentStep', stepNumber.toString());
            console.log('当前步骤已保存:', stepNumber);
        } catch (error) {
            console.error('保存步骤失败:', error);
        }

        // 设置对应步骤的功能
        if (stepNumber === 2) {
            this.setupStep2();
        } else if (stepNumber === 3) {
            await this.setupStep3();
        } else if (stepNumber === 4) {
            this.setupStep4();
        }

        // 滚动到顶部
        window.scrollTo(0, 0);
    },

    /**
     * 进入下一步
     */
    nextStep() {
        if (this.currentStep < 4) {
            this.switchToStep(this.currentStep + 1);
        }
    },

    /**
     * 返回上一步
     */
    prevStep() {
        if (this.currentStep > 1) {
            this.switchToStep(this.currentStep - 1);
        }
    },

    /**
     * 更新进度条
     */
    updateProgressBar(stepNumber) {
        const steps = document.querySelectorAll('.progress-step');
        const lines = document.querySelectorAll('.progress-line');
        
        steps.forEach((step, index) => {
            const num = index + 1;
            if (num < stepNumber) {
                step.classList.add('completed');
                step.classList.remove('active');
            } else if (num === stepNumber) {
                step.classList.add('active');
                step.classList.remove('completed');
            } else {
                step.classList.remove('active', 'completed');
            }
        });
        
        lines.forEach((line, index) => {
            if (index + 1 < stepNumber) {
                line.classList.add('completed');
                line.classList.remove('active');
            } else if (index + 1 === stepNumber) {
                line.classList.add('active');
                line.classList.remove('completed');
            } else {
                line.classList.remove('active', 'completed');
            }
        });
    },

    /**
     * 倒计时
     */
    startCountdown(button, seconds) {
        let remaining = seconds;
        button.disabled = true;
        button.textContent = `${remaining}秒后重试`;
        
        const timer = setInterval(() => {
            remaining--;
            if (remaining > 0) {
                button.textContent = `${remaining}秒后重试`;
            } else {
                clearInterval(timer);
                button.disabled = false;
                button.textContent = '获取验证码';
            }
        }, 1000);
    },

    /**
     * 验证身份证号
     */
    validateIdCard(idCard) {
        const reg = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
        return reg.test(idCard);
    },

    /**
     * 验证手机号
     */
    validatePhone(phone) {
        const reg = /^1[3-9]\d{9}$/;
        return reg.test(phone);
    },

    /**
     * 校验字段值是否可用（调用后台接口）
     * @param {string} attrKey - 字段名（'account'=登录账号, 'perEmail'=邮箱, 'cellPhone'=手机号）
     * @param {string} attrValue - 字段值
     * @returns {Promise<boolean>} - 返回是否可用
     */
    async validateFieldValue(attrKey, attrValue) {
        try {
            console.log(`🔍 校验字段: ${attrKey} = ${attrValue}`);

            const response = await fetch('api/validate-field', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    isFlat: false,
                    form_id_l: 3,
                    attr_key: attrKey,
                    attr_value: attrValue,
                    app_id: 'qoRz2jvwG0HmaEfxr7lV'
                })
            });

            const result = await response.json();
            console.log(`✅ 校验结果:`, result);

            // 判断校验是否成功
            // 成功返回: {"data":[{"result":"S"}]}
            if (result.data && result.data.length > 0 && result.data[0].result === 'S') {
                return true;
            }

            return false;
        } catch (error) {
            console.error(`❌ 字段校验失败 (${attrKey}):`, error);
            // 网络错误时，默认允许通过（避免阻塞用户）
            return true;
        }
    },

    /**
     * 保存用户数据到 sessionStorage
     */
    saveUserDataToStorage() {
        try {
            sessionStorage.setItem('kycUserData', JSON.stringify(this.userData));
            console.log('✅ 用户数据已保存到 sessionStorage');
            console.log('📋 保存的数据:', {
                realName: this.userData.realName,
                idCard: this.userData.idCard,
                mobile: this.userData.mobile
            });
        } catch (error) {
            console.error('保存用户数据失败:', error);
        }
    },

    /**
     * 从 sessionStorage 加载用户数据
     */
    loadUserDataFromStorage() {
        try {
            const data = sessionStorage.getItem('kycUserData');
            if (data) {
                this.userData = { ...this.userData, ...JSON.parse(data) };
                console.log('✅ 用户数据已从 sessionStorage 恢复');
                console.log('📋 恢复的数据:', {
                    realName: this.userData.realName,
                    idCard: this.userData.idCard,
                    mobile: this.userData.mobile
                });
            }
        } catch (error) {
            console.error('加载用户数据失败:', error);
        }
    },

    /**
     * 显示加载中
     */
    showLoading(message = '处理中...') {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'flex';
            // 如果有加载文本元素，更新文本
            const loadingText = overlay.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
        }
    },

    /**
     * 隐藏加载中
     */
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    },

    /**
     * 显示消息弹窗
     */
    showMessage(type, message) {
        const modal = document.getElementById('messageModal');
        const icon = document.getElementById('modalIcon');
        const messageEl = document.getElementById('modalMessage');
        const closeBtn = document.getElementById('btnModalClose');
        
        if (!modal) return;
        
        // 设置图标
        if (type === 'success') {
            icon.textContent = '✓';
            icon.className = 'modal-icon success';
        } else {
            icon.textContent = '✕';
            icon.className = 'modal-icon error';
        }
        
        // 设置消息
        messageEl.textContent = message;
        
        // 显示弹窗
        modal.style.display = 'flex';
        
        // 关闭按钮
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
        
        // 点击背景关闭
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    },

    /**
     * 复制文本到剪贴板
     */
    copyText(elementId, button) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        const text = element.textContent;
        
        // 创建临时 textarea
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        
        // 选择并复制
        textarea.select();
        try {
            document.execCommand('copy');
            button.textContent = '已复制';
            setTimeout(() => {
                button.textContent = '复制';
            }, 2000);
        } catch (err) {
            console.error('复制失败:', err);
        }
        
        // 移除临时元素
        document.body.removeChild(textarea);
    },

    /**
     * 重新开始流程
     */
    restartProcess() {
        if (confirm('确定要重新开始注册流程吗？')) {
            // 清除用户数据
            this.userData = {
                realName: '',
                idCard: '',
                mobile: '',
                province: '',
                provinceCode: '',
                city: '',
                cityCode: '',
                district: '',
                districtCode: '',
                address: '',
                email: '',
                authToken: '',
                authCode: '',
                frontImageUrl: '',
                backImageUrl: '',
                bankCard: '',
                bankName: '',
                bankCode: '',
                bankPhone: '',
                smsCode: '',
                session_id: ''
            };
            
            // 清除 sessionStorage
            sessionStorage.removeItem('kycUserData');
            
            // 重新加载页面
            window.location.reload();
        }
    }
};

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    window.kycApp.init();
});
