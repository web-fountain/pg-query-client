import VerticalHandle from '@Components/layout/ResizableHandle/VerticalHandle';
import styles         from './styles.module.css';


type Props = {
  top               : React.ReactNode;
  bottom            : React.ReactNode;
  topStyle          : React.CSSProperties;
  bottomStyle       : React.CSSProperties;
  topRef            : React.Ref<HTMLDivElement>;
  bottomRef         : React.Ref<HTMLDivElement>;
  containerRef      : React.RefObject<HTMLElement | null>;
  getRatio          : () => number;
  onChangeImmediate : (ratio: number) => void;
  onCommit          : (ratio: number) => void;
};

function SplitPane({ top, bottom, topStyle, bottomStyle, topRef, bottomRef, containerRef, getRatio, onChangeImmediate, onCommit }: Props) {
  return (
    <>
      <div className={styles['top-panel']} style={topStyle} ref={topRef}>
        <div className={styles['top-content']}>
          {top}
        </div>
      </div>

      <VerticalHandle
        containerRef={containerRef}
        getRatio={getRatio}
        onChangeImmediate={onChangeImmediate}
        onCommit={onCommit}
        className={styles['split-handle']}
      />

      <div className={styles['bottom-panel']} style={bottomStyle} ref={bottomRef}>
        {bottom}
      </div>
    </>
  );
}


export default SplitPane;
