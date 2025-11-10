/**
 * 银行卡工具类
 */

// 银行卡BIN码对照表（前6位）
const BANK_BIN_MAP = {
  // 中国邮政储蓄银行
  '621098': '中国邮政储蓄银行',
  '622188': '中国邮政储蓄银行',
  '955100': '中国邮政储蓄银行',
  '621096': '中国邮政储蓄银行',
  '622150': '中国邮政储蓄银行',
  '622151': '中国邮政储蓄银行',
  '622181': '中国邮政储蓄银行',
  '622199': '中国邮政储蓄银行',

  // 中国农业银行
  '621283': '中国农业银行',
  '622848': '中国农业银行',
  '621284': '中国农业银行',
  '103': '中国农业银行',

  // 中国工商银行
  '621227': '中国工商银行',
  '621226': '中国工商银行',
  '622200': '中国工商银行',
  '621225': '中国工商银行',
  '621281': '中国工商银行',
  '102': '中国工商银行',

  // 中国银行
  '621282': '中国银行',
  '621293': '中国银行',
  '621661': '中国银行',
  '621660': '中国银行',
  '621667': '中国银行',
  '621666': '中国银行',
  '621756': '中国银行',
  '456351': '中国银行',
  '104': '中国银行',

  // 中国建设银行
  '622581': '中国建设银行',
  '436742': '中国建设银行',
  '622280': '中国建设银行',
  '621080': '中国建设银行',
  '621081': '中国建设银行',
  '105': '中国建设银行',

  // 招商银行
  '622297': '招商银行',
  '621286': '招商银行',
  '621299': '招商银行',
  '621298': '招商银行',
  '690755': '招商银行',
  '308': '招商银行',

  // 兴业银行
  '622262': '兴业银行',
  '622908': '兴业银行',
  '622909': '兴业银行',
  '621439': '兴业银行',
  '309': '兴业银行',

  // 平安银行
  '621259': '平安银行',
  '622986': '平安银行',
  '622298': '平安银行',

  // 民生银行
  '622258': '民生银行',
  '622318': '民生银行',
  '622622': '民生银行',
  '415599': '民生银行',
  '421393': '民生银行',
  '517636': '民生银行',
  '305': '民生银行',

  // 广发银行
  '622616': '广发银行',
  '621352': '广发银行',
  '621568': '广发银行',

  // 浦发银行
  '621288': '浦发银行',
  '622177': '浦发银行',
  '622277': '浦发银行',

  // 中信银行
  '622230': '中信银行',
  '621771': '中信银行',
  '621767': '中信银行',
  '621761': '中信银行',
  '622690': '中信银行',

  // 光大银行
  '622261': '光大银行',
  '622660': '光大银行',
  '622662': '光大银行',
  '622663': '光大银行',
  '622664': '光大银行',
  '622665': '光大银行',
  '622666': '光大银行',
  '622667': '光大银行',
  '622669': '光大银行',

  // 华夏银行
  '621362': '华夏银行',
  '622630': '华夏银行',
  '621674': '华夏银行',

  // 交通银行
  '621062': '交通银行',
  '621063': '交通银行',
  '621064': '交通银行',
  '621700': '交通银行',
  '622260': '交通银行',
  '622261': '交通银行',
  '301': '交通银行'
};

// 银行名称到银行代码的映射（用于提交接口）
const BANK_NAME_TO_CODE = {
  '中国工商银行': '1002',
  '中国农业银行': '1005',
  '中国银行': '1026',
  '中国建设银行': '1003',
  '交通银行': '1020',
  '招商银行': '1001',
  '中国邮政储蓄银行': '1066',
  '中信银行': '1021',
  '中国光大银行': '1022',
  '华夏银行': '1025',
  '中国民生银行': '1006',
  '广发银行': '1027',
  '平安银行': '1010',
  '兴业银行': '1009',
  '浦发银行': '1004'
};

/**
 * 根据银行卡号获取银行名称
 * @param {String} cardNo 银行卡号
 * @returns {String} 银行名称
 */
window.getBankName = function(cardNo) {
  if (!cardNo || cardNo.length < 6) {
    return '';
  }

  // 移除空格
  cardNo = cardNo.replace(/\s/g, '');

  // 尝试匹配前6位
  const bin6 = cardNo.substring(0, 6);
  if (BANK_BIN_MAP[bin6]) {
    return BANK_BIN_MAP[bin6];
  }

  // 尝试匹配前3位（部分银行）
  const bin3 = cardNo.substring(0, 3);
  if (BANK_BIN_MAP[bin3]) {
    return BANK_BIN_MAP[bin3];
  }

  return '';
};

/**
 * 根据银行名称获取银行代码
 * @param {String} bankName 银行名称
 * @returns {String} 银行代码
 */
window.getBankCode = function(bankName) {
  return BANK_NAME_TO_CODE[bankName] || '';
};

/**
 * 验证银行卡号格式（Luhn算法）
 * @param {String} cardNo 银行卡号
 * @returns {Boolean} 是否有效
 */
window.validateBankCard = function(cardNo) {
  if (!cardNo) return false;

  // 移除空格
  cardNo = cardNo.replace(/\s/g, '');

  // 长度检查（13-19位）
  if (cardNo.length < 13 || cardNo.length > 19) {
    return false;
  }

  // 只能包含数字
  if (!/^\d+$/.test(cardNo)) {
    return false;
  }

  // Luhn算法校验
  return luhnCheck(cardNo);
};

/**
 * Luhn算法校验银行卡号
 * @param {String} cardNo 银行卡号
 * @returns {Boolean} 校验结果
 */
function luhnCheck(cardNo) {
  let sum = 0;
  let shouldDouble = false;

  // 从右向左遍历
  for (let i = cardNo.length - 1; i >= 0; i--) {
    let digit = parseInt(cardNo.charAt(i));

    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }

    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return (sum % 10) === 0;
}

/**
 * 格式化银行卡号（每4位添加空格）
 * @param {String} cardNo 银行卡号
 * @returns {String} 格式化后的卡号
 */
window.formatBankCard = function(cardNo) {
  if (!cardNo) return '';

  // 移除所有空格
  cardNo = cardNo.replace(/\s/g, '');

  // 每4位添加空格
  return cardNo.replace(/(.{4})/g, '$1 ').trim();
};

/**
 * 获取所有银行列表（去重排序）
 * @returns {Array} 银行名称数组
 */
window.getAllBanks = function() {
  // 从BANK_BIN_MAP中提取所有银行名称
  const bankSet = new Set(Object.values(BANK_BIN_MAP));

  // 转为数组并排序
  const banks = Array.from(bankSet).sort((a, b) => {
    return a.localeCompare(b, 'zh-CN');
  });

  return banks;
};

console.log('✅ 银行卡工具类已加载');
