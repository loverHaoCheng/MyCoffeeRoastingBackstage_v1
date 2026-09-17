import { useState } from 'react';

import { cn } from '@/shared/utils/cn';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/shared/components/ui/drawer';
import Button from 'antd/es/button';

import styles from './time-picker.module.css';

interface TimePickerInputProps {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  value: number;
}

interface WheelPickerProps {
  max: number;
  min: number;
  onChange: (value: number) => void;
  value: number;
}

function WheelPicker({ max, min, onChange, value }: WheelPickerProps) {
  const [currentValue, setCurrentValue] = useState(value);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const itemHeight = 40;
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const handleStart = (clientY: number) => {
    setIsDragging(true);
    setStartY(clientY);
  };

  const handleMove = (clientY: number) => {
    if (!isDragging) return;

    const deltaY = startY - clientY;
    const steps = Math.round(deltaY / itemHeight);
    const currentIndex = values.indexOf(currentValue);
    const newIndex = Math.max(0, Math.min(values.length - 1, currentIndex + steps));
    const newValue = values[newIndex];

    if (newValue !== undefined && newValue !== currentValue) {
      setCurrentValue(newValue);
      setStartY(clientY);
    }
  };

  const handleEnd = () => {
    setIsDragging(false);
    onChange(currentValue);
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const direction = event.deltaY > 0 ? 1 : -1;
    const newValue = Math.max(min, Math.min(max, currentValue + direction));
    setCurrentValue(newValue);
  };

  const currentIndex = values.indexOf(currentValue);

  return (
    <div
      className={styles.picker}
      onMouseDown={(e) => {
        handleStart(e.clientY);
      }}
      onMouseMove={(e) => {
        handleMove(e.clientY);
      }}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={(e) => {
        handleStart(e.touches[0]?.clientY ?? 0);
      }}
      onTouchMove={(e) => {
        handleMove(e.touches[0]?.clientY ?? 0);
      }}
      onTouchEnd={handleEnd}
      onWheel={handleWheel}
      role="spinbutton"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={currentValue}
    >
      <div className={styles.highlight} />
      <div
        className={styles.wheel}
        style={{
          transform: `translateY(${String(80 - currentIndex * itemHeight)}px)`,
        }}
      >
        {values.map((num) => (
          <div
            className={cn(styles.item, num === currentValue && styles.itemActive)}
            key={num}
            onClick={() => {
              setCurrentValue(num);
            }}
          >
            {String(num).padStart(2, '0')}
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimePicker({ label, max = 59, min = 0, onChange, value }: TimePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const handleOpen = () => {
    setTempValue(value);
    setIsOpen(true);
  };

  const handleConfirm = () => {
    onChange(tempValue);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setTempValue(value);
    setIsOpen(false);
  };

  return (
    <>
      <button
        className={styles.inputButton}
        onClick={handleOpen}
        type="button"
        aria-label={label}
      >
        {String(value).padStart(2, '0')}
      </button>

      <Drawer
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            handleCancel();
          }
        }}
        placement="bottom"
        showSwipeHandle
      >
        <DrawerContent className={styles.drawerContent}>
          <DrawerHeader className={styles.drawerHeader}>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>

          <div className={styles.drawerBody}>
            <WheelPicker
              max={max}
              min={min}
              onChange={setTempValue}
              value={tempValue}
            />
          </div>

          <DrawerFooter className={styles.drawerFooter}>
            <div className={styles.drawerActions}>
              <Button block onClick={handleCancel} size="large">
                取消
              </Button>
              <Button block onClick={handleConfirm} size="large" type="primary">
                确认
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
