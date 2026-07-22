import UploadOutlined from '@ant-design/icons/UploadOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Drawer from 'antd/es/drawer';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import { useRef, useState } from 'react';

import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import { useCreateRoasterModel } from '../hooks';
import { roasterMachineService } from '../services/roasterMachine.service';
import type { RoasterModelRecognition } from '../types/roasterMachine';

import styles from './RoasterModelSubmission.module.css';

const readDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => { resolve(typeof reader.result === 'string' ? reader.result : ''); };
  reader.onerror = () => { reject(new Error('参数图片读取失败。')); };
  reader.readAsDataURL(file);
});

export function RoasterModelSubmission() {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RoasterModelRecognition | null>(null);
  const [specificationsText, setSpecificationsText] = useState('{}');
  const [jsonError, setJsonError] = useState('');
  const [recognizing, setRecognizing] = useState(false);
  const createModel = useCreateRoasterModel();

  const chooseImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setRecognizing(true);
    try {
      const recognized = await roasterMachineService.recognizeModelImage(await readDataUrl(file));
      setDraft(recognized);
      setSpecificationsText(JSON.stringify(recognized.specifications, null, 2));
      setJsonError('');
      void message.success('参数已识别，请核对后提交。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '参数识别失败，请更换清晰图片后重试。'));
    } finally {
      setRecognizing(false);
    }
  };

  const updateSpecifications = (value: string) => {
    setSpecificationsText(value);

    try {
      const parsed = JSON.parse(value) as unknown;

      if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) {
        setJsonError('机器参数必须是 JSON 对象。');
        return;
      }

      setDraft((current) => current ? { ...current, specifications: parsed as Record<string, unknown> } : current);
      setJsonError('');
    } catch {
      setJsonError('机器参数不是有效的 JSON。');
    }
  };

  const submit = async () => {
    if (!draft?.brand.trim() || !draft.modelName.trim() || jsonError) {
      return;
    }

    try {
      await createModel.mutateAsync(draft);
      setDraft(null);
      setOpen(false);
      void message.success('机型已提交审核，当前账号可以立即关联。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '机型提交失败，请检查字段后重试。'));
    }
  };

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>提交新机型</Button>
      <Drawer
        className={styles.drawer}
        destroyOnHidden
        onClose={() => { setOpen(false); }}
        open={open}
        title="提交新机型"
      >
        <div className={styles.form}>
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              void chooseImage(event.target.files?.[0]);
              event.target.value = '';
            }}
            ref={inputRef}
            type="file"
          />
          <Button icon={<UploadOutlined />} loading={recognizing} onClick={() => { inputRef.current?.click(); }}>
            上传参数图片
          </Button>
          {draft ? (
            <>
              <label>
                <span>品牌</span>
                <Input onChange={(event) => { setDraft({ ...draft, brand: event.target.value }); }} value={draft.brand} />
              </label>
              <label>
                <span>型号</span>
                <Input onChange={(event) => { setDraft({ ...draft, modelName: event.target.value }); }} value={draft.modelName} />
              </label>
              <label>
                <span>烘焙类型</span>
                <Select
                  onChange={(value) => { setDraft({ ...draft, roastType: value }); }}
                  options={[
                    { label: '直火', value: 'direct_fire' },
                    { label: '半热风', value: 'semi_hot_air' },
                    { label: '热风', value: 'hot_air' },
                    { label: '其他', value: 'other' },
                  ]}
                  value={draft.roastType}
                />
              </label>
              <label>
                <span>机器参数</span>
                <Input.TextArea autoSize={{ minRows: 6, maxRows: 12 }} onChange={(event) => { updateSpecifications(event.target.value); }} value={specificationsText} />
              </label>
              {jsonError ? <p className={styles.error}>{jsonError}</p> : null}
              <Button
                block
                disabled={!draft.brand.trim() || !draft.modelName.trim() || Boolean(jsonError)}
                loading={createModel.isPending}
                onClick={() => { void submit(); }}
                type="primary"
              >
                提交审核
              </Button>
            </>
          ) : null}
        </div>
      </Drawer>
    </>
  );
}
