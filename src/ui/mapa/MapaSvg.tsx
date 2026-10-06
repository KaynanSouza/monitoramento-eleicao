import { memo, useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import { type Camada, corArea, type ResumoArea } from '@/mapa/dados';
import { type Caixa, caminhoMunicipio } from '@/mapa/geo';
import { caminhoUf, obterMalha } from '@/mapa/malha';
import { useTema } from '../tema';

interface Props {
  largura: number;
  altura: number;
  caixa: Caixa;
  /** UFs desenhadas (todas no Brasil, uma no recorte estadual). */
  ufs: string[];
  /** Resumo por UF, usado onde não há dados municipais. */
  resumosUf?: Map<string, ResumoArea>;
  camadas: Camada[];
  ufsComMunicipios: Set<string>;
  /** Código IBGE do município destacado (toque). */
  destaque?: string | null;
}

/**
 * Mapa SVG. As áreas com dados municipais são desenhadas em poucas camadas agrupadas
 * por cor; UFs sem dados municipais usam a cor do líder estadual (ou neutra).
 * Contornos de estado brancos e mais grossos por cima.
 */
export const MapaSvg = memo(function MapaSvg({
  largura,
  altura,
  caixa,
  ufs,
  resumosUf,
  camadas,
  ufsComMunicipios,
  destaque,
}: Props) {
  const t = useTema();
  const contorno = t.fundo; // contornos na cor do fundo (branco no tema claro)
  const semDados = t.trilho;

  const contornoUfs = useMemo(() => ufs.map(caminhoUf).join(''), [ufs]);
  const destaqueD = useMemo(() => {
    if (!destaque) return null;
    const m = obterMalha().mun.find((x) => x.i === destaque);
    return m ? caminhoMunicipio(m) : null;
  }, [destaque]);

  return (
    <Svg width={largura} height={altura} viewBox={caixa.join(' ')} preserveAspectRatio="xMidYMid meet">
      {ufs
        .filter((uf) => !ufsComMunicipios.has(uf))
        .map((uf) => {
          const r = resumosUf?.get(uf);
          return <Path key={uf} d={caminhoUf(uf)} fill={r ? corArea(r, t.fundo) : semDados} fillRule="evenodd" />;
        })}
      {camadas.map((c) => (
        <Path
          key={c.cor}
          d={c.d}
          fill={c.cor}
          fillRule="evenodd"
          stroke={contorno}
          strokeWidth={0.4}
          strokeOpacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <Path d={contornoUfs} fill="none" stroke={contorno} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      {destaqueD && (
        <Path d={destaqueD} fill="none" stroke={t.texto} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
      )}
    </Svg>
  );
});
