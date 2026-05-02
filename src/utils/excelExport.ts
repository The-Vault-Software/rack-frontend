import * as XLSX from 'xlsx';

export function exportSaleToExcel(sale: any) {
  // Hoja 1: Resumen de la Venta
  const summaryData = [
    {
      "Nº de Venta": sale.seq_number,
      "Fecha": new Date(sale.created_at).toLocaleString(),
      "Cliente": sale.customer_name || 'Consumidor Final',
      "ID/RIF Cliente": sale.customer || 'N/A',
      "Estado de Pago": sale.payment_status === 'PAID' ? 'Pagado' : sale.payment_status === 'PARTIALLY_PAID' ? 'Pago Parcial' : 'Pendiente',
      "Total USD": parseFloat(sale.total_amount_usd || '0').toFixed(2),
      "Total Pagado USD": parseFloat(sale.total_paid || '0').toFixed(2),
      "Saldo Pendiente USD": (parseFloat(sale.total_amount_usd || '0') - parseFloat(sale.total_paid || '0')).toFixed(2)
    }
  ];

  // Hoja 2: Detalles de Productos
  const detailsData = sale.sale_details.map((detail: any) => ({
    "Producto": detail.product_name,
    "Cantidad": detail.quantity,
    "Precio Unitario USD": parseFloat(detail.unit_price || '0').toFixed(2),
    "Subtotal USD": (parseFloat(detail.quantity) * parseFloat(detail.unit_price || '0')).toFixed(2)
  }));

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsDetails = XLSX.utils.json_to_sheet(detailsData);

  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Venta");
  XLSX.utils.book_append_sheet(wb, wsDetails, "Productos");

  XLSX.writeFile(wb, `Venta_${sale.seq_number}.xlsx`);
}

export function exportAccountToExcel(account: any) {
  // Hoja 1: Resumen de la Cuenta
  const summaryData = [
    {
      "Nº de Cuenta": account.seq_number,
      "Fecha": new Date(account.created_at).toLocaleString(),
      "Proveedor": account.provider_name || 'Desconocido',
      "ID/RIF Proveedor": account.provider || 'N/A',
      "Estado de Pago": account.payment_status === 'PAID' ? 'Pagado' : account.payment_status === 'PARTIALLY_PAID' ? 'Pago Parcial' : 'Pendiente',
      "Total USD": parseFloat(account.total_amount_usd || '0').toFixed(2),
      "Total Pagado USD": parseFloat(account.total_paid || '0').toFixed(2),
      "Saldo Pendiente USD": (parseFloat(account.total_amount_usd || '0') - parseFloat(account.total_paid || '0')).toFixed(2)
    }
  ];

  // Hoja 2: Detalles de Productos
  const detailsData = account.account_details.map((detail: any) => ({
    "Producto": detail.product_name,
    "Cantidad": detail.quantity,
    "Precio Unitario USD": parseFloat(detail.unit_price || '0').toFixed(2),
    "Subtotal USD": (parseFloat(detail.quantity) * parseFloat(detail.unit_price || '0')).toFixed(2)
  }));

  const wb = XLSX.utils.book_new();
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  const wsDetails = XLSX.utils.json_to_sheet(detailsData);

  XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Cuenta");
  XLSX.utils.book_append_sheet(wb, wsDetails, "Productos");

  XLSX.writeFile(wb, `Cuenta_${account.seq_number}.xlsx`);
}
