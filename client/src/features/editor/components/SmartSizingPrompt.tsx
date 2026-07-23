import styles from './SmartSizingPrompt.module.css';

interface SmartSizingPromptProps {
  imageWidth: number;
  imageHeight: number;
  onAccept: () => void;
  onDismiss: () => void;
}

export function SmartSizingPrompt({
  imageWidth,
  imageHeight,
  onAccept,
  onDismiss,
}: SmartSizingPromptProps) {
  return (
    <div className={styles.overlay}>
      <div className={styles.prompt}>
        <p className={styles.message}>
          This background image is larger than the current canvas ({imageWidth}&times;{imageHeight}
          ). Resize the canvas to match?
        </p>
        <div className={styles.actions}>
          <button className={styles.acceptButton} onClick={onAccept} type="button">
            Resize Canvas
          </button>
          <button className={styles.dismissButton} onClick={onDismiss} type="button">
            Keep Current Size
          </button>
        </div>
      </div>
    </div>
  );
}
