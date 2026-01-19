
import React from 'react';
import type { MeasurementUnit } from '../../client/types.gen';
import { Edit2, Trash2, Scale } from 'lucide-react';

interface MobileUnitListProps {
  units: MeasurementUnit[];
  onEdit: (unit: MeasurementUnit) => void;
  onDelete: (unit: MeasurementUnit) => void;
}

const MobileUnitList: React.FC<MobileUnitListProps> = ({
  units,
  onEdit,
  onDelete,
}) => {
  if (units.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 bg-white rounded-lg shadow">
        No se encontraron unidades.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {units.map((unit) => (
        <div key={unit.id} className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-50 rounded-full text-indigo-600">
                    <Scale className="h-5 w-5" />
                </div>
                <div>
                    <h3 className="font-medium text-gray-900">{unit.name}</h3>
                    <p className="text-sm text-gray-500">
                        Decimales: {unit.decimals ? 'Sí' : 'No'}
                    </p>
                </div>
            </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => onEdit(unit)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
              aria-label={`Editar ${unit.name}`}
            >
              <Edit2 className="h-5 w-5" />
            </button>
            <button 
              onClick={() => onDelete(unit)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
              aria-label={`Eliminar ${unit.name}`}
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MobileUnitList;
