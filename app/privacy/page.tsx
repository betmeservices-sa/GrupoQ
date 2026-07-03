import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad, Centro de Comunicación",
  description: "Política de privacidad del Centro de Comunicación.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-white px-6 py-12 text-[#25323f]">
      <h1 className="text-2xl font-extrabold tracking-tight text-[#0f1b2d]">
        Política de Privacidad
      </h1>
      <p className="mt-1 text-sm text-brand">Centro de Comunicación</p>
      <p className="mt-1 text-xs text-[#94a3b4]">Última actualización: 2 de julio de 2026</p>

      <div className="mt-8 space-y-6 text-[14.5px] leading-relaxed">
        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">1. Quiénes somos</h2>
          <p>
            El Centro de Comunicación es la plataforma interna de comunicación de la empresa,
            que unifica la atención a clientes por WhatsApp, redes sociales y correo
            electrónico, junto con la coordinación interna entre áreas.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">2. Qué datos tratamos</h2>
          <p>
            Tratamos los datos necesarios para atender al cliente: nombre, número de teléfono o
            identificador de la red social, y el contenido de los mensajes que el cliente nos
            envía. No solicitamos información financiera sensible a través de estos canales.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">3. Para qué los usamos</h2>
          <p>
            Usamos estos datos únicamente para responder consultas, agendar y recordar citas,
            dar seguimiento a los servicios y a la atención. No vendemos ni compartimos los
            datos con terceros con fines comerciales.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">4. WhatsApp y Meta</h2>
          <p>
            La comunicación por WhatsApp se procesa a través de la API de WhatsApp Business de
            Meta, conforme a sus términos y políticas. El cliente puede solicitar dejar de recibir
            mensajes en cualquier momento respondiendo a la conversación.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">5. Conservación y seguridad</h2>
          <p>
            Los mensajes se almacenan de forma segura y se conservan solo durante el tiempo
            necesario para la atención. El acceso está restringido al personal autorizado de
            la empresa mediante control de acceso por rol.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">6. Tus derechos</h2>
          <p>
            El cliente puede solicitar acceder, corregir o eliminar sus datos contactando a
            la empresa. Atenderemos la solicitud conforme a la legislación de protección de datos
            aplicable en El Salvador.
          </p>
        </section>

        <section>
          <h2 className="mb-1.5 text-base font-bold text-[#0f1b2d]">7. Contacto</h2>
          <p>
            Para cualquier consulta sobre esta política, comuníquese con la empresa a través de
            sus canales oficiales de atención.
          </p>
        </section>
      </div>
    </main>
  );
}
