const OSS = require('ali-oss');
const path = require('path');

// 从环境变量读取 OSS 配置
const ossConfig = {
  region: process.env.OSS_REGION || 'oss-cn-hangzhou',
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
  bucket: process.env.OSS_BUCKET,
  endpoint: process.env.OSS_ENDPOINT
};

// 检查 OSS 配置是否完整
function isOssConfigured() {
  return !!(
    ossConfig.accessKeyId &&
    ossConfig.accessKeySecret &&
    ossConfig.bucket
  );
}

// 创建 OSS 客户端
function createOssClient() {
  if (!isOssConfigured()) {
    throw new Error('OSS 配置不完整，请检查环境变量: OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET');
  }

  return new OSS({
    region: ossConfig.region,
    accessKeyId: ossConfig.accessKeyId,
    accessKeySecret: ossConfig.accessKeySecret,
    bucket: ossConfig.bucket,
    endpoint: ossConfig.endpoint
  });
}

/**
 * 上传文件到 OSS
 * @param {Buffer|Stream} fileBuffer - 文件缓冲区或流
 * @param {String} originalName - 原始文件名
 * @param {String} folder - OSS 存储文件夹 (可选，默认 'uploads')
 * @returns {Promise<Object>} - 返回 { url, name } 对象
 */
async function uploadToOss(fileBuffer, originalName, folder = 'kyc-uploads') {
  try {
    // 生成唯一文件名
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 15);
    const fileName = `${folder}/${timestamp}-${randomStr}${ext}`;

    console.log('[OSS上传] 开始上传文件:', fileName);

    // 创建 OSS 客户端
    const client = createOssClient();

    // 上传文件
    const result = await client.put(fileName, fileBuffer);

    console.log('[OSS上传] 上传成功:', result.url);

    return {
      url: result.url,
      name: result.name,
      fileName: fileName
    };
  } catch (error) {
    console.error('[OSS上传] 上传失败:', error);
    throw new Error(`OSS 上传失败: ${error.message}`);
  }
}

/**
 * 删除 OSS 上的文件
 * @param {String} fileName - OSS 上的文件名（完整路径）
 * @returns {Promise<void>}
 */
async function deleteFromOss(fileName) {
  try {
    const client = createOssClient();
    await client.delete(fileName);
    console.log('[OSS删除] 删除成功:', fileName);
  } catch (error) {
    console.error('[OSS删除] 删除失败:', error);
    throw new Error(`OSS 删除失败: ${error.message}`);
  }
}

/**
 * 批量上传文件到 OSS
 * @param {Array} files - multer 上传的文件数组
 * @param {String} folder - OSS 存储文件夹
 * @returns {Promise<Array>} - 返回上传结果数组
 */
async function uploadMultipleToOss(files, folder = 'kyc-uploads') {
  const uploadPromises = files.map(file => {
    return uploadToOss(file.buffer, file.originalname, folder);
  });

  return Promise.all(uploadPromises);
}

module.exports = {
  isOssConfigured,
  uploadToOss,
  deleteFromOss,
  uploadMultipleToOss,
  ossConfig
};
