import { useRef, useState, type ChangeEvent } from 'react';
import ApiOutlined from "@ant-design/icons/ApiOutlined";
import CheckOutlined from "@ant-design/icons/CheckOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import ScanOutlined from "@ant-design/icons/ScanOutlined";
import UploadOutlined from "@ant-design/icons/UploadOutlined";
import Alert from "antd/es/alert";
import { App } from 'antd';
import Button from "antd/es/button";
import Empty from "antd/es/empty";
import Spin from "antd/es/spin";

import {
  beanAiRecognitionService,
  getAiGatewayHealthUrl,
  getBeanAiRecognitionRequestUrl,
} from '@/modules/bean/services';
import type { BeanImageRecognitionResult } from '@/modules/bean/types';
import { AppError } from '@/shared/errors/AppError';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './BeanAiRecognitionPlaceholder.module.css';

const maxSourceImageBytes = 20 * 1024 * 1024;
const maxRecognitionImageBytes = 2 * 1024 * 1024;
const recognitionImageMaxSide = 1600;
const jpegCompressionQualities = [0.82, 0.72, 0.62, 0.52];

interface BeanAiRecognitionPlaceholderProps {
  onApplyRecognition?: (recognition: BeanImageRecognitionResult) => void;
}

interface RecognitionField {
  label: string;
  value: string;
}

interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  originalBytes: number;
  outputBytes: number;
}

interface AiGatewayDiagnostic {
  healthStatusText: string;
  healthUrl: string;
  message: string;
  pageUrl: string;
  recognitionUrl: string;
  sourceText: string;
  status: 'failed' | 'success';
}

const getCurrentPageUrl = (): string => {
  if (typeof window === 'undefined') {
    return '当前运行环境无法读取页面地址';
  }

  return window.location.href;
};

const buildAiGatewayDiagnostic = (input: {
  healthStatusText?: string;
  message: string;
  sourceText: string;
  status: AiGatewayDiagnostic['status'];
}): AiGatewayDiagnostic => {
  return {
    healthStatusText: input.healthStatusText ?? '未检测',
    healthUrl: getAiGatewayHealthUrl(),
    message: input.message,
    pageUrl: getCurrentPageUrl(),
    recognitionUrl: getBeanAiRecognitionRequestUrl(),
    sourceText: input.sourceText,
    status: input.status,
  };
};

const blobToDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('图片读取失败，请重新选择图片。'));
    });
    reader.addEventListener('error', () => {
      reject(new Error('图片读取失败，请重新选择图片。'));
    });
    reader.readAsDataURL(blob);
  });
};

const dataUrlToBytes = (dataUrl: string): number => {
  const base64 = dataUrl.split(',')[1] ?? '';

  if (!base64) {
    return 0;
  }

  return Math.floor((base64.length * 3) / 4);
};

const formatFileSize = (bytes: number): string => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  return `${String(Math.max(1, Math.round(bytes / 1024)))}KB`;
};

const calculateResizeTarget = (width: number, height: number): { height: number; width: number } => {
  const longestSide = Math.max(width, height);

  if (longestSide <= recognitionImageMaxSide) {
    return {
      height,
      width,
    };
  }

  const ratio = recognitionImageMaxSide / longestSide;

  return {
    height: Math.max(1, Math.round(height * ratio)),
    width: Math.max(1, Math.round(width * ratio)),
  };
};

const loadImageElement = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.addEventListener('load', () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    });
    image.addEventListener('error', () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('图片解码失败，请更换图片后重试。'));
    });
    image.src = objectUrl;
  });
};

const canvasToJpegBlob = (
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('图片压缩失败，请更换图片后重试。'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
};

const compressImageForRecognition = async (file: File): Promise<CompressedImageResult> => {
  const image = await loadImageElement(file);
  const target = calculateResizeTarget(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('当前浏览器不支持图片压缩，请更换浏览器或图片后重试。');
  }

  canvas.width = target.width;
  canvas.height = target.height;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, target.width, target.height);
  context.drawImage(image, 0, 0, target.width, target.height);

  let bestDataUrl = '';
  let bestBlob: Blob | null = null;
  let bestBytes = Number.POSITIVE_INFINITY;

  for (const quality of jpegCompressionQualities) {
    const blob = await canvasToJpegBlob(canvas, quality);
    const dataUrl = await blobToDataUrl(blob);
    const outputBytes = blob.size || dataUrlToBytes(dataUrl);

    bestBlob = blob;
    bestDataUrl = dataUrl;
    bestBytes = outputBytes;

    if (outputBytes <= maxRecognitionImageBytes) {
      break;
    }
  }

  if (bestBytes > maxRecognitionImageBytes) {
    throw new Error('图片压缩后仍然过大，请裁剪图片后重试。');
  }

  if (!bestBlob) {
    throw new Error('图片压缩失败，请更换图片后重试。');
  }

  return {
    blob: bestBlob,
    dataUrl: bestDataUrl,
    originalBytes: file.size,
    outputBytes: bestBytes,
  };
};

const formatNumber = (value: null | number, suffix: string): string => {
  return value == null ? '' : `${String(value)}${suffix}`;
};

const formatAltitude = (recognition: BeanImageRecognitionResult): string => {
  if (recognition.altitudeMetersMin == null && recognition.altitudeMetersMax == null) {
    return '';
  }

  if (recognition.altitudeMetersMin != null && recognition.altitudeMetersMax != null) {
    return `${String(recognition.altitudeMetersMin)}-${String(recognition.altitudeMetersMax)}m`;
  }

  return `${String(recognition.altitudeMetersMin ?? recognition.altitudeMetersMax)}m`;
};

const buildRecognitionFields = (recognition: BeanImageRecognitionResult): RecognitionField[] => {
  return [
    { label: '编号', value: recognition.code },
    { label: '名称', value: recognition.displayName },
    { label: '国家', value: recognition.originCountry },
    { label: '产区', value: recognition.originRegion },
    { label: '小产区', value: recognition.originArea },
    { label: '处理法', value: recognition.processMethod },
    { label: '豆种', value: recognition.variety },
    { label: '等级', value: recognition.grade },
    { label: '产季', value: recognition.harvestSeason },
    { label: '处理厂', value: recognition.millName },
    { label: '风味', value: recognition.flavorTags.join('、') },
    { label: '海拔', value: formatAltitude(recognition) },
    { label: '含水率', value: formatNumber(recognition.moisturePercent, '%') },
    { label: '密度', value: formatNumber(recognition.densityGPerL, 'g/L') },
    { label: '供应商', value: recognition.supplierName },
  ].filter((field) => field.value.trim().length > 0);
};

export function BeanAiRecognitionPlaceholder({ onApplyRecognition }: BeanAiRecognitionPlaceholderProps) {
  const { message } = App.useApp();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imagePreviewDataUrl, setImagePreviewDataUrl] = useState('');
  const [recognitionImageBlob, setRecognitionImageBlob] = useState<Blob | null>(null);
  const [imageSizeText, setImageSizeText] = useState('');
  const [imageName, setImageName] = useState('');
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isCheckingGateway, setIsCheckingGateway] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognition, setRecognition] = useState<BeanImageRecognitionResult | null>(null);
  const [gatewayDiagnostic, setGatewayDiagnostic] = useState<AiGatewayDiagnostic | null>(null);
  const [usageText, setUsageText] = useState('');
  const recognitionFields = recognition ? buildRecognitionFields(recognition) : [];

  const chooseImage = () => {
    fileInputRef.current?.click();
  };

  const clearImage = () => {
    setImagePreviewDataUrl('');
    setRecognitionImageBlob(null);
    setImageSizeText('');
    setImageName('');
    setRecognition(null);
    setGatewayDiagnostic(null);
    setUsageText('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      void message.warning('请选择 jpeg、png 或 webp 图片。');
      event.target.value = '';
      return;
    }

    if (file.size > maxSourceImageBytes) {
      void message.warning('原图不能超过 20MB。');
      event.target.value = '';
      return;
    }

    setIsPreparingImage(true);

    try {
      const compressedImage = await compressImageForRecognition(file);

      setImagePreviewDataUrl(compressedImage.dataUrl);
      setRecognitionImageBlob(compressedImage.blob);
      setImageSizeText(
        `原图 ${formatFileSize(compressedImage.originalBytes)}，已压缩为 ${formatFileSize(compressedImage.outputBytes)}`,
      );
      setImageName(file.name);
      setRecognition(null);
      setGatewayDiagnostic(null);
      setUsageText('');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '图片处理失败，请重新选择图片。'));
      event.target.value = '';
    } finally {
      setIsPreparingImage(false);
    }
  };

  const checkAiGateway = async () => {
    setIsCheckingGateway(true);

    try {
      await beanAiRecognitionService.checkGatewayHealth();
      setGatewayDiagnostic(buildAiGatewayDiagnostic({
        healthStatusText: '可达',
        message: 'AI 网关健康检查已连通。',
        sourceText: '手动检测服务',
        status: 'success',
      }));
      void message.success('AI 网关健康检查已连通。');
    } catch (error) {
      const errorMessage = getUserFacingErrorMessage(
        error,
        'AI 网关健康检查失败，请确认当前页面地址和开发服务是否可访问。',
      );

      setGatewayDiagnostic(buildAiGatewayDiagnostic({
        healthStatusText: '不可达',
        message: errorMessage,
        sourceText: '手动检测服务',
        status: 'failed',
      }));
      void message.error(errorMessage);
    } finally {
      setIsCheckingGateway(false);
    }
  };

  const recognizeSelectedImage = async () => {
    if (!recognitionImageBlob) {
      void message.warning('请先选择图片。');
      return;
    }

    setIsRecognizing(true);

    try {
      const result = await beanAiRecognitionService.recognizeImage(recognitionImageBlob);

      setRecognition(result.recognition);
      setGatewayDiagnostic(null);
      setUsageText(`本月已用 ${String(result.usedThisMonth)} / ${String(result.monthlyLimit)}，剩余 ${String(result.remainingUses)}`);
      void message.success('识别完成，请确认结果后回填。');
    } catch (error) {
      const errorMessage = getUserFacingErrorMessage(
        error,
        '识别请求未能到达服务端，请确认手机能访问当前电脑的开发服务并保持登录状态。',
      );

      if (error instanceof AppError && error.code === 'NETWORK') {
        let healthStatusText = '不可达';

        try {
          await beanAiRecognitionService.checkGatewayHealth();
          healthStatusText = '可达';
        } catch {
          healthStatusText = '不可达';
        }

        setGatewayDiagnostic(buildAiGatewayDiagnostic({
          healthStatusText,
          message: healthStatusText === '可达'
            ? `${errorMessage}；但 /api/health 可达，说明基础网关通了，问题集中在图片识别 POST 请求。`
            : `${errorMessage}；同时 /api/health 不可达，说明手机当前浏览器到开发网关的接口请求链路不通。`,
          sourceText: '开始识别',
          status: 'failed',
        }));
      }

      void message.error(
        errorMessage,
      );
    } finally {
      setIsRecognizing(false);
    }
  };

  const diagnosticDescription = gatewayDiagnostic ? (
    <dl className={styles.diagnosticGrid}>
      <div>
        <dt>触发来源</dt>
        <dd>{gatewayDiagnostic.sourceText}</dd>
      </div>
      <div>
        <dt>页面地址</dt>
        <dd>{gatewayDiagnostic.pageUrl}</dd>
      </div>
      <div>
        <dt>健康检查</dt>
        <dd>
          <a href={gatewayDiagnostic.healthUrl} rel="noreferrer" target="_blank">
            {gatewayDiagnostic.healthUrl}
          </a>
        </dd>
      </div>
      <div>
        <dt>健康检查实测</dt>
        <dd>{gatewayDiagnostic.healthStatusText}</dd>
      </div>
      <div>
        <dt>识别接口</dt>
        <dd>{gatewayDiagnostic.recognitionUrl}</dd>
      </div>
      <div>
        <dt>结果</dt>
        <dd>{gatewayDiagnostic.message}</dd>
      </div>
    </dl>
  ) : null;

  const applyRecognition = () => {
    if (!recognition) {
      return;
    }

    onApplyRecognition?.(recognition);
  };

  return (
    <section className={styles.panel} aria-label="AI 图片识别">
      <input
        accept="image/jpeg,image/png,image/webp"
        aria-label="上传生豆图片"
        className={styles.fileInput}
        onChange={(event) => {
          void handleImageChange(event);
        }}
        ref={fileInputRef}
        type="file"
      />

      <div className={styles.uploadSurface}>
        {imagePreviewDataUrl ? (
          <img alt={imageName || '待识别图片'} className={styles.previewImage} src={imagePreviewDataUrl} />
        ) : (
          <div className={styles.emptyPreview}>
            <UploadOutlined aria-hidden="true" />
            <span>上传袋标、采购单或生豆标签</span>
          </div>
        )}
      </div>

      <div className={styles.actionGrid}>
        <Button disabled={isPreparingImage || isRecognizing} icon={<UploadOutlined />} onClick={chooseImage}>
          {isPreparingImage ? '处理图片中' : imagePreviewDataUrl ? '更换图片' : '选择图片'}
        </Button>
        <Button
          disabled={!recognitionImageBlob || isRecognizing}
          icon={<ScanOutlined />}
          loading={isPreparingImage || isRecognizing}
          onClick={() => {
            void recognizeSelectedImage();
          }}
          type="primary"
        >
          开始识别
        </Button>
        <Button
          disabled={isPreparingImage || isRecognizing}
          icon={<ApiOutlined />}
          loading={isCheckingGateway}
          onClick={() => {
            void checkAiGateway();
          }}
        >
          检测服务
        </Button>
        {imagePreviewDataUrl ? (
          <Button disabled={isPreparingImage || isRecognizing} icon={<DeleteOutlined />} onClick={clearImage}>
            清除
          </Button>
        ) : null}
      </div>

      {imageSizeText ? <p className={styles.imageMetaText}>{imageSizeText}</p> : null}
      {usageText ? <p className={styles.usageText}>{usageText}</p> : null}
      {gatewayDiagnostic ? (
        <Alert
          className={styles.diagnosticAlert}
          description={diagnosticDescription}
          message={gatewayDiagnostic.status === 'success' ? '服务检测通过' : '服务检测失败'}
          showIcon
          type={gatewayDiagnostic.status === 'success' ? 'success' : 'error'}
        />
      ) : null}

      <section className={styles.resultPanel} aria-label="识别结果">
        <header className={styles.resultHeader}>
          <h3>识别结果</h3>
          <Button
            disabled={!recognition}
            icon={<CheckOutlined />}
            onClick={applyRecognition}
            type="primary"
          >
            回填表单
          </Button>
        </header>

        {isRecognizing ? (
          <div className={styles.loading}>
            <Spin />
          </div>
        ) : recognitionFields.length > 0 ? (
          <dl className={styles.resultGrid}>
            {recognitionFields.map((field) => (
              <div className={styles.resultItem} key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <Empty className={styles.emptyResult} description="暂无识别结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )}
      </section>
    </section>
  );
}
