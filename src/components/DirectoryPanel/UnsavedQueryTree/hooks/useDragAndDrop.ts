// AIDEV-NOTE: Encapsulates row-level HTML5 DnD handlers bound to the row's id and folder-ness.
import { OnDropMove } from '../types';


type Handlers = {
  onDragStart: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
};

export function useDragAndDrop(id: string, isFolder: boolean, onDropMove: OnDropMove): Handlers {
  return {
    onDragStart: (e) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
    },
    onDragOver: (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    },
    onDrop: async (e) => {
      e.preventDefault();
      const dragId = e.dataTransfer.getData('text/plain');
      if (!dragId || dragId === id) return;
      await onDropMove(dragId, id, isFolder);
    }
  };
}
