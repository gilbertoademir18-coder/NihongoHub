import Image from "next/image";

/**
 * A imagem ilustrativa de um card.
 *
 * Altura fixa em vez de proporção livre: as imagens vêm de fontes diferentes
 * e chegam em todo formato, e um bloco que muda de tamanho a cada palavra
 * empurraria o resto do resultado para cima e para baixo a cada resposta. Com
 * altura fixa e `object-cover`, o recorte varia mas o layout não salta.
 *
 * O crédito fica visível de propósito: as imagens são de licença aberta, e
 * praticamente todas as licenças Creative Commons exigem atribuição. Pequeno
 * e discreto, mas presente — a alternativa honesta seria não usar as imagens.
 */
export function ImagemDoCard({
  src,
  alt,
  credito,
}: {
  src: string;
  alt: string;
  credito: string | null;
}) {
  return (
    <figure className="mb-3">
      <div className="relative mx-auto h-40 w-full max-w-xs overflow-hidden rounded-lg bg-surface-muted">
        <Image
          src={src}
          alt={alt}
          fill
          // A imagem nunca passa de `max-w-xs`; sem isto o Next geraria e
          // serviria tamanhos grandes demais para o espaço que ela ocupa.
          sizes="20rem"
          className="object-cover"
        />
      </div>
      {credito && (
        <figcaption className="mt-1 text-[11px] text-muted">{credito}</figcaption>
      )}
    </figure>
  );
}
