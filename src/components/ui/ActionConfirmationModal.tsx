import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { AlertTriangle } from 'lucide-react';

interface ActionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger';
}

export default function ActionConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning'
}: ActionConfirmationModalProps) {
  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-sm transform overflow-visible rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`${variant === 'warning' ? 'bg-orange-100' : 'bg-red-100'} p-3 rounded-full`}>
                        <AlertTriangle className={`h-8 w-8 ${variant === 'warning' ? 'text-orange-600' : 'text-red-600'}`} />
                    </div>
                    
                    <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 leading-6">
                        {title}
                    </Dialog.Title>

                    <p className="text-gray-600 text-sm">
                        {description}
                    </p>

                    <div className="flex w-full gap-3 pt-2">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={onConfirm}
                            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium shadow-sm transition-colors ${
                                variant === 'warning' 
                                    ? 'bg-orange-600 hover:bg-orange-700' 
                                    : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
