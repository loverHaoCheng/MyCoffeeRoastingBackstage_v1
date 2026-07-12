import type { BeanImageRecognitionResult } from '@/modules/bean/types';

const maxRecognitionImageBytes = 2 * 1024 * 1024;
const recognitionImageMaxSide = 1600;
const jpegCompressionQualities = [0.82, 0.72, 0.62, 0.52];

export const maxSourceImageBytes = 20 * 1024 * 1024;

export interface RecognitionField {
  label: string;
  value: string;
}

export interface CompressedImageResult {
  blob: Blob;
  dataUrl: string;
  originalBytes: number;
  outputBytes: number;
}

export interface AiGatewayDiagnostic {
  healthStatusText: string;
  healthUrl: string;
  message: string;
  pageUrl: string;
  recognitionUrl: string;
  sourceText: string;
  status: 'failed' | 'success';
}

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

export const formatFileSize = (bytes: number): string => {
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

export const compressImageForRecognition = async (file: File): Promise<CompressedImageResult> => {
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

export const buildRecognitionFields = (recognition: BeanImageRecognitionResult): RecognitionField[] => {
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
