/**
 * Regras para encaixar a descrição do cupom num subitem do IPCA.
 *
 * As descrições chegam abreviadas e em maiúsculas ("QJ M FRESC BANDEIRA PT KG",
 * "CR DEN COLGATE"). Antes de testar, o texto é normalizado: sem acentos,
 * maiúsculas, pontuação vira espaço (veja `normalizar`).
 *
 * A PRIMEIRA regra que casar vence, então as mais específicas vêm antes
 * (ex.: "biscoito de chocolate" antes de "chocolate"; "creme dental" antes de "creme de leite").
 *
 * Para contribuir: acrescente a regra perto das parecidas e um caso em
 * test/classificacao.test.ts. Os códigos estão em dados/catalogo-ipca.txt.
 */
export const REGRAS: readonly (readonly [subitem: string, padrao: RegExp])[] = [
  // ---------- Higiene pessoal (6301) e limpeza (2104): antes dos alimentos, por causa de "CR", "PH", "SAB"
  ['6301007', /\b(CR(EME)? DEN(T|TAL)?|PASTA DENT|ESC(OVA)? DENT|FIO DENT|ENXAG|ANTISSEPTICO BUCAL|COLGATE|SORRISO|ORAL B|CLOSE UP)\b/],
  ['6301017', /\b(PH|PAPEL HIG(IENICO)?|PAP HIG|P HIG)\b/],
  ['6301016', /\b(SABONETE|SAB(ONETE)? (LIQ|BARRA)|SABON)\b/],
  ['6301014', /\b(DESOD(ORANTE)?|ANTITRANSP|AEROSOL REXONA|REXONA)\b/],
  ['6301001', /\b(SHAMPOO|XAMPU|SH |CONDICIONADOR|COND CAB|CREME (DE )?PENTEAR|TINTURA|COLORACAO)\b/],
  ['6301002', /\b(FRALDA|FRALD)\b/],
  ['6301015', /\b(ABSORV(ENTE)?|PROTETOR DIARIO)\b/],
  ['6301004', /\b(APARELHO (DE )?BARB|LAMINA|ESPUMA (DE )?BARB|GILLETTE|PRESTOBARBA)\b/],
  ['6301006', /\b(HIDRAT(ANTE)?|PROTETOR SOLAR|LOCAO CORP)\b/],
  ['2104016', /\b(ESPON(JA)?|BOMBRIL|PALHA DE ACO|ESPON ACO|SCOTCH BRITE)\b/],
  ['2104005', /\b(AGUA SANIT(ARIA)?|AG SANIT|QBOA|CANDIDA)\b/],
  ['2104008', /\b(DETERG(ENTE)?|LAVA LOUCA|YPE LAVA)\b/],
  ['2104009', /\b(SABAO (EM )?PO|LAVA ROUPA(S)? PO|OMO|BRILHANTE PO)\b/],
  ['2104019', /\b(SABAO LIQ(UIDO)?|LAVA ROUPA(S)? LIQ)\b/],
  ['2104015', /\b(SABAO (EM )?BARRA|SABAO BARRA|SABAO PEDRA)\b/],
  ['2104085', /\b(AMACIANTE|AMAC|ALVEJANTE|TIRA MANCHA|VANISH|COMFORT|DOWNY)\b/],
  ['2104012', /\b(DESINF(ETANTE)?|PINHO SOL|LYSOFORM)\b/],
  ['2104020', /\b(LIMP(ADOR)?|MULTIUSO|VEJA|LIMPA VIDRO|LUSTRA MOVEIS|CIF)\b/],
  ['2104003', /\b(SACO (PARA |P |DE )?LIXO|SACO LIXO)\b/],
  ['2104041', /\b(PAPEL TOALHA|PAP TOALHA|TOALHA PAPEL)\b/],

  // ---------- Panificados e biscoitos (antes de chocolate, queijo, milho)
  ['1112003', /\b(BISC(OITO)?|BOLACHA|COOKIE|WAFER|CREAM CRACKER|ROSQUINHA)\b/],
  ['1112025', /\bPAO (DE )?QUEIJO\b/],
  ['1112015', /\bPAO (FRANCES|FRANCEZ|SAL)\b|\bPAOZINHO\b/],
  ['1112017', /\bPAO DOCE\b|\bSONHO\b/],
  ['1112019', /\bBOLO\b/],
  ['1112018', /\b(PAO|BISNAGUINHA|PULLMAN|NUTRELLA|WICKBOLD|SEVEN BOYS|PANCO)\b/],

  // ---------- Leites e derivados
  ['1111008', /\b(LEITE COND(ENSADO)?|LT COND|MOCOCA COND|MOCA)\b/],
  ['1111009', /\bLEITE (EM )?PO\b|\bNINHO\b/],
  ['1111038', /\b(LEITE FERM(ENTADO)?|YAKULT|CHAMYTO)\b/],
  ['1111019', /\b(IOG(URTE)?|BEB(IDA)? LACT(EA)?|DANONE|DANONINHO|NESTON|PETIT SUISSE)\b/],
  ['1111021', /\b(REQ(UEIJAO)?|CATUPIRY)\b/],
  ['1111031', /\bMANT(EIGA)?\b/],
  ['1111011', /\b(QJ|QUEIJO|QJO|MUSS(ARELA)?|MUCARELA|PARMESAO|PROVOLONE|RICOTA|MINAS FRESCAL|MINAS PADRAO|FRESCAL)\b/],
  ['1116001', /\bLEITE (DE )?COCO\b/],
  // Creme de leite não tem subitem próprio no IPCA: fica sem categoria (regra só para não cair em "leite").
  ['', /\b(CR(EME)? (DE )?LEITE)\b/],
  // "Leite" só no começo da descrição: evita "CHOC ... AO LEITE" e "BISC ... LEITE".
  ['1111004', /^(LEITE|LT INT|LT DESN)\b/],

  // ---------- Carnes (açougue)
  ['1107089', /\bPATINHO\b/],
  ['1107088', /\bALCATRA\b/],
  ['1107208', /\bPICANHA\b/],
  ['1107084', /\bCONTRA ?FILE\b/],
  ['1107085', /\bFILE MIGNON\b/],
  ['1107087', /\b(CHA DE DENTRO|COXAO MOLE)\b/],
  ['1107091', /\bLAGARTO\b/],
  ['1107093', /\bMUSCULO\b/],
  ['1107095', /\bACEM\b/],
  ['1107094', /\b(PALETA|PA BOV)\b/],
  ['1107096', /\bPEITO BOV\b/],
  ['1107097', /\bCAPA (DE )?FILE\b/],
  ['1107099', /\bCOSTELA\b/],
  ['1107081', /\bCUPIM\b/],
  ['1107009', /\bFIGADO\b/],
  ['1107018', /\b(LOMBO|PERNIL|BISTECA|COSTELINHA SUINA|CARNE SUINA|SUINO)\b/],

  // ---------- Aves e ovos
  ['1110044', /\bOVOS?\b/],
  ['1110009', /\bFRANGO (INTEIRO|INT|RESF(RIADO)? INT)\b/],
  ['1110010', /\b(FRANGO|FILE FGO|COXA|SOBRECOXA|ASA FGO|PEITO (DE )?FRANGO|FGO)\b/],

  // ---------- Carnes e peixes industrializados
  ['1109002', /\b(PRES(UNTO)?|APRESUNTADO)\b/],
  ['1109007', /\bSALSICHA\b/],
  ['1109008', /\bLINGUICA\b/],
  ['1109010', /\bMORTADELA\b/],
  ['1109012', /\bSALAME\b/],
  ['1109023', /\bBACALHAU\b/],
  ['1109056', /\b(CARNE SECA|CHARQUE|CARNE DE SOL)\b/],

  // ---------- Enlatados e conservas
  ['1115075', /\bATUM\b/],
  ['1115039', /\bSARDINHA\b(?!.*\bKG\b)/],
  ['1101079', /\bMILHO (DE )?PIPOCA\b|\bMILHO (EM )?GRAO\b/],
  ['1115058', /\bMILHO( VERDE)?\b.*\b\d+ ?G\b|\bMILHO VERDE\b/],
  ['1115057', /\bAZEITONA\b/],
  ['1115016', /\bPALMITO\b/],
  ['1115056', /\bSOPA\b/],

  // ---------- Pescados frescos
  ['1108012', /\bSARDINHA\b/],
  ['1108080', /\bTILAPIA\b/],
  ['1108075', /\bSALMAO\b/],
  ['1108031', /\bMERLUZA\b/],
  ['1108038', /\bPESCADA\b/],
  ['1108013', /\bCAMARAO\b/],

  // ---------- Açúcares e derivados
  ['1104052', /\b(ACHOC(OLATADO)?|NESCAU|TODDY|CHOCOLATE EM PO|CHOC PO)\b/],
  ['1104023', /\b(CHOC(OLATE)?|BOMBOM|BOM|BARRA CHOC|KIT KAT|BIS)\b/],
  ['1104018', /\b(BALA|BALAS|CHICLETE|PIRULITO)\b/],
  ['1104032', /\bSORVETE\b/],
  ['1104060', /\b(GOIABADA|DOCE DE LEITE|DOCE (DE )?FRUTA|MARMELADA)\b/],
  ['1104067', /\bACUCAR DEMERARA\b/],
  ['1104004', /\bACUCAR CRISTAL\b/],
  ['1104003', /\bACUCAR\b/],

  // ---------- Cereais, farinhas e massas
  ['1101002', /\bARROZ\b/],
  ['1101052', /\bFEIJAO PRETO\b/],
  ['1101053', /\bFEIJAO (FRADINHO|MACACAR)\b/],
  ['1101073', /\bFEIJAO\b/],
  ['1101079', /\bMILHO\b/],
  ['1102061', /\b(MIOJO|MAC(ARRAO)? INST(ANTANEO)?|LAMEN|NISSIN)\b/],
  ['1102006', /\b(MACARRAO|MAC|ESPAGUETE|PARAFUSO|PENNE|MASSA)\b/],
  ['1102012', /\bFAR(INHA)? (DE )?TRIGO\b/],
  ['1102023', /\bFAR(INHA)? (DE )?MANDIOCA\b/],
  ['1102008', /\bFUBA\b/],
  ['1102010', /\b(FLOCOS DE MILHO|FLOCAO|CORN FLAKES|SUCRILHOS)\b/],

  // ---------- Óleos e gorduras
  ['1113013', /\bOLEO (DE )?SOJA\b|\bOLEO\b/],
  ['1113014', /\bAZEITE\b/],
  ['1113040', /\b(MARGARINA|MARG|QUALY|DORIANA)\b/],

  // ---------- Bebidas e infusões
  ['1114023', /\bCAFE SOL(UVEL)?\b|\bNESCAFE\b/],
  ['1114022', /\bCAFE\b/],
  ['1114090', /\bSUCO (EM )?PO\b|\bTANG\b|\bREFRESCO\b/],
  ['1114001', /\bSUCO\b|\bNECTAR\b/],
  ['1114083', /\b(REFRIG(ERANTE)?|AGUA MIN(ERAL)?|AGUA S ?GAS|COCA COLA|GUARANA|SODA)\b/],
  ['1114084', /\b(CERV(EJA)?|CERVEJA|SKOL|BRAHMA|HEINEKEN|ITAIPAVA|AMSTEL)\b/],
  ['1114087', /\bVINHO\b/],
  ['1114091', /\b(ERVA MATE|CHA MATE|MATE LEAO)\b/],

  // ---------- Sal e condimentos
  ['1116013', /\bSAL\b/],
  ['1116010', /\bALHO\b/],
  ['1116005', /\b(EXTRATO (DE )?TOMATE|MOLHO (DE )?TOMATE|ATOMATADO|POLPA (DE )?TOMATE)\b/],
  ['1116033', /\bMAIONESE\b/],
  ['1116041', /\bVINAGRE\b/],
  ['1116026', /\bFERMENTO\b/],
  ['1116048', /\bCALDO\b/],
  ['1116022', /\bCOLORAU\b/],
  ['1116071', /\b(TEMPERO|SAZON|SAL TEMPERADO)\b/],

  // ---------- Frutas
  ['1106008', /\bBANANA PRATA\b/],
  ['1106006', /\bBANANA MACA\b/],
  ['1106001', /\bBANANA (DA )?TERRA\b/],
  ['1106005', /\bBANANA\b/],
  ['1106039', /\bLARANJA PERA\b/],
  ['1106012', /\bLARANJA LIMA\b/],
  ['1106011', /\bLARANJA\b/],
  ['1106015', /\bLIMAO\b/],
  ['1106017', /\bMACA\b/],
  ['1106018', /\bMAMAO\b/],
  ['1106019', /\bMANGA\b/],
  ['1106020', /\bMARACUJA\b/],
  ['1106021', /\bMELANCIA\b/],
  ['1106022', /\bMELAO\b/],
  ['1106023', /\bPERA\b/],
  ['1106027', /\b(TANGERINA|MEXERICA|PONKAN|BERGAMOTA)\b/],
  ['1106028', /\bUVA\b/],
  ['1106003', /\bABACAXI\b/],
  ['1106004', /\bABACATE\b/],
  ['1106051', /\bMORANGO\b/],
  ['1106084', /\bGOIABA\b/],

  // ---------- Tubérculos, legumes, hortaliças
  ['1103002', /\bBATATA DOCE\b/],
  // Batata palha e chips não têm subitem próprio: ficam sem categoria.
  ['', /\bBAT(ATA)? PALHA\b|\bCHIPS\b/],
  ['1103003', /\bBATATA\b/],
  ['1103005', /\b(MANDIOCA|AIPIM|MACAXEIRA)\b/],
  ['1103028', /\bTOMATE\b/],
  ['1103043', /\bCEBOLA\b/],
  ['1103044', /\bCENOURA\b/],
  ['1103020', /\bABOBRINHA\b/],
  ['1103025', /\bPEPINO\b/],
  ['1103026', /\bPIMENTAO\b/],
  ['1105001', /\bALFACE\b/],
  ['1105005', /\bCOUVE\b(?! FLOR)/],
  ['1105006', /\bCOUVE FLOR\b/],
  ['1105010', /\bREPOLHO\b/],
  ['1105019', /\bBROCOLIS\b/],
  ['1105012', /\b(CHEIRO VERDE|SALSINHA|CEBOLINHA)\b/],
  ['1105004', /\bCOENTRO\b/],
];
