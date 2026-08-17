// Terminal state reached after any 402 (expired or revoked licence). Copy is
// intentionally neutral and static — it never reads the 402 body's `detail`
// text, since string-matching it would couple behaviour to wording that can
// change with no compile error and no failing test. No backend `code` field
// ships today, so there is nothing to discriminate on even if we wanted to.
export default function LicenseInactivePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-gray-900">Tu licencia no está activa</h1>
      <p className="mt-4 max-w-md text-gray-600">
        No es posible acceder a la aplicación en este momento. Contáctanos para resolver el
        estado de tu licencia.
      </p>
      <a
        href="mailto:soporte@rack.app"
        className="mt-6 inline-block font-medium text-blue-600 hover:text-blue-500"
      >
        Contactar a soporte
      </a>
    </div>
  );
}
