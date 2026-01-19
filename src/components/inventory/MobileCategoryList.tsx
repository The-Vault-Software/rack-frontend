
import React from 'react';
import type { Category } from '../../client/types.gen';
import { Edit2, Trash2, Tag } from 'lucide-react';

interface MobileCategoryListProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (category: Category) => void;
}

const MobileCategoryList: React.FC<MobileCategoryListProps> = ({
  categories,
  onEdit,
  onDelete,
}) => {
  if (categories.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow">
        No se encontraron categorías.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((category) => (
        <div key={category.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-full text-blue-600">
                <Tag className="h-5 w-5" />
            </div>
            <span className="font-medium text-gray-900">{category.name}</span>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => onEdit(category)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              aria-label={`Editar ${category.name}`}
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button 
              onClick={() => onDelete(category)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
              aria-label={`Eliminar ${category.name}`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MobileCategoryList;
