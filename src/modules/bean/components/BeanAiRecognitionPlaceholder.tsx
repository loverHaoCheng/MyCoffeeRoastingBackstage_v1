import ApiOutlined from "@ant-design/icons/ApiOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import ScanOutlined from "@ant-design/icons/ScanOutlined";
import UploadOutlined from "@ant-design/icons/UploadOutlined";
import App from 'antd/es/app';
import Button from "antd/es/button";
import { useRef, useState, type ChangeEvent } from 'react';

import {
  beanAiRecognitionService,
  getAiGatewayHealthUrl,
  getBeanAiRecognitionRequestUrl,
} from '@/modules/bean/services';
import type { BeanImageRecognitionResult } from '@/modules/bean/types';
import { AppError } from '@/shared/errors/AppError';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import { BeanAiRecognitionDiagnosticAlert } from './bean-ai-recognition/BeanAiRecognitionDiagnosticAlert';
import { BeanAiRecognitionResultPanel } from './bean-ai-recognition/BeanAiRecognitionResultPanel';
import {
  buildRecognitionFields,
  compressImageForRecognition,
  type AiGatewayDiagnostic,
  formatFileSize,
  maxSourceImageBytes,
} from './bean-ai-recognition/beanAiRecognitionPlaceholder.utils';
import styles from './BeanAiRecognitionPlaceholder.module.css';

interface BeanAiRecognitionPlaceholderProps {
  onApplyRecognition?: (recognition: BeanImageRecognitionResult) => void;
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
      {gatewayDiagnostic ? <BeanAiRecognitionDiagnosticAlert gatewayDiagnostic={gatewayDiagnostic} /> : null}

      <BeanAiRecognitionResultPanel
        isRecognizing={isRecognizing}
        onApplyRecognition={applyRecognition}
        recognition={recognition}
        recognitionFields={recognitionFields}
      />
    </section>
  );
}
