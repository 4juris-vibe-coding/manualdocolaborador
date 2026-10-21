export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      avaliacoes_experiencia: {
        Row: {
          avaliado_id: string
          avaliador_id: string | null
          cargo_id: string | null
          criado_em: string
          data_referencia: string
          departamento_id: string | null
          expira_em: string
          id: string
          nota: number | null
          periodo_dias: number
          respondido_em: string | null
          status: Database["public"]["Enums"]["status_avaliacao_experiencia"]
          unidade_id: string | null
        }
        Insert: {
          avaliado_id: string
          avaliador_id?: string | null
          cargo_id?: string | null
          criado_em?: string
          data_referencia: string
          departamento_id?: string | null
          expira_em: string
          id?: string
          nota?: number | null
          periodo_dias: number
          respondido_em?: string | null
          status?: Database["public"]["Enums"]["status_avaliacao_experiencia"]
          unidade_id?: string | null
        }
        Update: {
          avaliado_id?: string
          avaliador_id?: string | null
          cargo_id?: string | null
          criado_em?: string
          data_referencia?: string
          departamento_id?: string | null
          expira_em?: string
          id?: string
          nota?: number | null
          periodo_dias?: number
          respondido_em?: string | null
          status?: Database["public"]["Enums"]["status_avaliacao_experiencia"]
          unidade_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_experiencia_avaliado_id_fkey"
            columns: ["avaliado_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_experiencia_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_experiencia_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_experiencia_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_experiencia_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiarios: {
        Row: {
          beneficio_id: string
          colaborador_id: string
          criado_em: string
          id: string
        }
        Insert: {
          beneficio_id: string
          colaborador_id: string
          criado_em?: string
          id?: string
        }
        Update: {
          beneficio_id?: string
          colaborador_id?: string
          criado_em?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiarios_beneficio_id_fkey"
            columns: ["beneficio_id"]
            isOneToOne: false
            referencedRelation: "beneficios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiarios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficios: {
        Row: {
          aplicado_como: Database["public"]["Enums"]["aplicado_como_beneficio"]
          criado_em: string
          id: string
          nome: string
          opcao_desconto:
            | Database["public"]["Enums"]["opcao_desconto_beneficio"]
            | null
          periodicidade: Database["public"]["Enums"]["periodicidade_beneficio"]
          tipo: Database["public"]["Enums"]["tipo_beneficio"]
          valor_beneficio: number
          valor_descontado: number | null
        }
        Insert: {
          aplicado_como?: Database["public"]["Enums"]["aplicado_como_beneficio"]
          criado_em?: string
          id?: string
          nome: string
          opcao_desconto?:
            | Database["public"]["Enums"]["opcao_desconto_beneficio"]
            | null
          periodicidade?: Database["public"]["Enums"]["periodicidade_beneficio"]
          tipo: Database["public"]["Enums"]["tipo_beneficio"]
          valor_beneficio?: number
          valor_descontado?: number | null
        }
        Update: {
          aplicado_como?: Database["public"]["Enums"]["aplicado_como_beneficio"]
          criado_em?: string
          id?: string
          nome?: string
          opcao_desconto?:
            | Database["public"]["Enums"]["opcao_desconto_beneficio"]
            | null
          periodicidade?: Database["public"]["Enums"]["periodicidade_beneficio"]
          tipo?: Database["public"]["Enums"]["tipo_beneficio"]
          valor_beneficio?: number
          valor_descontado?: number | null
        }
        Relationships: []
      }
      cargo_tracos_comportamentais: {
        Row: {
          cargo_id: string
          chave: string
          id: string
          valor: number
        }
        Insert: {
          cargo_id: string
          chave: string
          id?: string
          valor?: number
        }
        Update: {
          cargo_id?: string
          chave?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cargo_tracos_comportamentais_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      cargos: {
        Row: {
          assistencias: string[]
          atividades: string | null
          atualizado_em: string
          cargo_superior_id: string | null
          codigo_cbo: string | null
          criado_em: string
          descricao: string | null
          habilidades: string[]
          id: string
          nome: string
          perfil_analista: number | null
          perfil_comunicador: number | null
          perfil_executor: number | null
          perfil_planejador: number | null
          piso_salarial: number | null
          piso_salarial_visivel: boolean
          responsaveis_ids: string[]
          senioridade: Database["public"]["Enums"]["senioridade_cargo"] | null
        }
        Insert: {
          assistencias?: string[]
          atividades?: string | null
          atualizado_em?: string
          cargo_superior_id?: string | null
          codigo_cbo?: string | null
          criado_em?: string
          descricao?: string | null
          habilidades?: string[]
          id?: string
          nome: string
          perfil_analista?: number | null
          perfil_comunicador?: number | null
          perfil_executor?: number | null
          perfil_planejador?: number | null
          piso_salarial?: number | null
          piso_salarial_visivel?: boolean
          responsaveis_ids?: string[]
          senioridade?: Database["public"]["Enums"]["senioridade_cargo"] | null
        }
        Update: {
          assistencias?: string[]
          atividades?: string | null
          atualizado_em?: string
          cargo_superior_id?: string | null
          codigo_cbo?: string | null
          criado_em?: string
          descricao?: string | null
          habilidades?: string[]
          id?: string
          nome?: string
          perfil_analista?: number | null
          perfil_comunicador?: number | null
          perfil_executor?: number | null
          perfil_planejador?: number | null
          piso_salarial?: number | null
          piso_salarial_visivel?: boolean
          responsaveis_ids?: string[]
          senioridade?: Database["public"]["Enums"]["senioridade_cargo"] | null
        }
        Relationships: [
          {
            foreignKeyName: "cargos_cargo_superior_id_fkey"
            columns: ["cargo_superior_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_topicos: {
        Row: {
          criado_em: string
          descricao: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_checklist"]
        }
        Insert: {
          criado_em?: string
          descricao: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_checklist"]
        }
        Update: {
          criado_em?: string
          descricao?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_checklist"]
        }
        Relationships: []
      }
      ciclo_avaliativo_participantes: {
        Row: {
          avaliado_id: string
          avaliador_id: string
          ciclo_id: string
          criado_em: string
          id: string
        }
        Insert: {
          avaliado_id: string
          avaliador_id: string
          ciclo_id: string
          criado_em?: string
          id?: string
        }
        Update: {
          avaliado_id?: string
          avaliador_id?: string
          ciclo_id?: string
          criado_em?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ciclo_avaliativo_participantes_avaliado_id_fkey"
            columns: ["avaliado_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclo_avaliativo_participantes_avaliador_id_fkey"
            columns: ["avaliador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ciclo_avaliativo_participantes_ciclo_id_fkey"
            columns: ["ciclo_id"]
            isOneToOne: false
            referencedRelation: "ciclos_avaliativos"
            referencedColumns: ["id"]
          },
        ]
      }
      ciclos_avaliativos: {
        Row: {
          admitidos_ate: string | null
          autoavaliacao: boolean
          comentario_competencia_mostrar: boolean
          comentario_competencia_obrigatorio: boolean
          comentario_geral_obrigatorio: boolean
          criado_em: string
          data_abertura: string | null
          data_encerramento: string | null
          descricao: string | null
          etapa_atual: string
          id: string
          niveis_escala: number
          nivel_estrutura:
            | Database["public"]["Enums"]["nivel_estrutura_avaliacao"]
            | null
          nome: string
          opcao_estrutura_id: string | null
          rotulo_escala: string | null
          status: Database["public"]["Enums"]["status_ciclo_avaliativo"]
          tipo_relacao: Database["public"]["Enums"]["tipo_relacao_avaliacao"]
          tipos_contrato:
            | Database["public"]["Enums"]["tipo_contrato_colaborador"][]
            | null
        }
        Insert: {
          admitidos_ate?: string | null
          autoavaliacao?: boolean
          comentario_competencia_mostrar?: boolean
          comentario_competencia_obrigatorio?: boolean
          comentario_geral_obrigatorio?: boolean
          criado_em?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          descricao?: string | null
          etapa_atual?: string
          id?: string
          niveis_escala?: number
          nivel_estrutura?:
            | Database["public"]["Enums"]["nivel_estrutura_avaliacao"]
            | null
          nome: string
          opcao_estrutura_id?: string | null
          rotulo_escala?: string | null
          status?: Database["public"]["Enums"]["status_ciclo_avaliativo"]
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao_avaliacao"]
          tipos_contrato?:
            | Database["public"]["Enums"]["tipo_contrato_colaborador"][]
            | null
        }
        Update: {
          admitidos_ate?: string | null
          autoavaliacao?: boolean
          comentario_competencia_mostrar?: boolean
          comentario_competencia_obrigatorio?: boolean
          comentario_geral_obrigatorio?: boolean
          criado_em?: string
          data_abertura?: string | null
          data_encerramento?: string | null
          descricao?: string | null
          etapa_atual?: string
          id?: string
          niveis_escala?: number
          nivel_estrutura?:
            | Database["public"]["Enums"]["nivel_estrutura_avaliacao"]
            | null
          nome?: string
          opcao_estrutura_id?: string | null
          rotulo_escala?: string | null
          status?: Database["public"]["Enums"]["status_ciclo_avaliativo"]
          tipo_relacao?: Database["public"]["Enums"]["tipo_relacao_avaliacao"]
          tipos_contrato?:
            | Database["public"]["Enums"]["tipo_contrato_colaborador"][]
            | null
        }
        Relationships: []
      }
      colaborador_dependentes: {
        Row: {
          colaborador_id: string
          cpf: string | null
          criado_em: string
          data_nascimento: string | null
          id: string
          nome: string
          parentesco: string
        }
        Insert: {
          colaborador_id: string
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          parentesco: string
        }
        Update: {
          colaborador_id?: string
          cpf?: string | null
          criado_em?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          parentesco?: string
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_dependentes_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_documentos: {
        Row: {
          caminho_arquivo: string
          categoria: string
          colaborador_id: string
          criado_em: string
          enviado_por: string | null
          id: string
          nome: string
          tamanho_bytes: number | null
        }
        Insert: {
          caminho_arquivo: string
          categoria?: string
          colaborador_id: string
          criado_em?: string
          enviado_por?: string | null
          id?: string
          nome: string
          tamanho_bytes?: number | null
        }
        Update: {
          caminho_arquivo?: string
          categoria?: string
          colaborador_id?: string
          criado_em?: string
          enviado_por?: string | null
          id?: string
          nome?: string
          tamanho_bytes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_documentos_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_documentos_enviado_por_fkey"
            columns: ["enviado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_exames: {
        Row: {
          colaborador_id: string
          criado_em: string
          criado_por: string | null
          data_exame: string
          data_validade: string | null
          documento_id: string | null
          id: string
          medico_crm: string | null
          medico_nome: string | null
          observacoes: string | null
          resultado: Database["public"]["Enums"]["resultado_exame_ocupacional"]
          tipo_exame: Database["public"]["Enums"]["tipo_exame_ocupacional"]
        }
        Insert: {
          colaborador_id: string
          criado_em?: string
          criado_por?: string | null
          data_exame: string
          data_validade?: string | null
          documento_id?: string | null
          id?: string
          medico_crm?: string | null
          medico_nome?: string | null
          observacoes?: string | null
          resultado?: Database["public"]["Enums"]["resultado_exame_ocupacional"]
          tipo_exame: Database["public"]["Enums"]["tipo_exame_ocupacional"]
        }
        Update: {
          colaborador_id?: string
          criado_em?: string
          criado_por?: string | null
          data_exame?: string
          data_validade?: string | null
          documento_id?: string | null
          id?: string
          medico_crm?: string | null
          medico_nome?: string | null
          observacoes?: string | null
          resultado?: Database["public"]["Enums"]["resultado_exame_ocupacional"]
          tipo_exame?: Database["public"]["Enums"]["tipo_exame_ocupacional"]
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_exames_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_exames_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_exames_documento_id_fkey"
            columns: ["documento_id"]
            isOneToOne: false
            referencedRelation: "colaborador_documentos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_historico_cargo: {
        Row: {
          alterado_por: string | null
          cargo_anterior_id: string | null
          cargo_novo_id: string | null
          colaborador_id: string
          criado_em: string
          id: string
          salario_anterior: number | null
          salario_novo: number | null
        }
        Insert: {
          alterado_por?: string | null
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          colaborador_id: string
          criado_em?: string
          id?: string
          salario_anterior?: number | null
          salario_novo?: number | null
        }
        Update: {
          alterado_por?: string | null
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          colaborador_id?: string
          criado_em?: string
          id?: string
          salario_anterior?: number | null
          salario_novo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_historico_cargo_alterado_por_fkey"
            columns: ["alterado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_historico_cargo_cargo_anterior_id_fkey"
            columns: ["cargo_anterior_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_historico_cargo_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_historico_cargo_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_links_preenchimento: {
        Row: {
          cargo_id: string | null
          colaborador_criado_id: string | null
          criado_em: string
          criado_por: string | null
          departamento_id: string | null
          expira_em: string
          id: string
          token: string
          usado_em: string | null
        }
        Insert: {
          cargo_id?: string | null
          colaborador_criado_id?: string | null
          criado_em?: string
          criado_por?: string | null
          departamento_id?: string | null
          expira_em: string
          id?: string
          token?: string
          usado_em?: string | null
        }
        Update: {
          cargo_id?: string | null
          colaborador_criado_id?: string | null
          criado_em?: string
          criado_por?: string | null
          departamento_id?: string | null
          expira_em?: string
          id?: string
          token?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_links_preenchimento_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_links_preenchimento_colaborador_criado_id_fkey"
            columns: ["colaborador_criado_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_links_preenchimento_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaborador_links_preenchimento_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_tracos_comportamentais: {
        Row: {
          chave: string
          colaborador_id: string
          id: string
          valor: number
        }
        Insert: {
          chave: string
          colaborador_id: string
          id?: string
          valor?: number
        }
        Update: {
          chave?: string
          colaborador_id?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "colaborador_tracos_comportamentais_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      colaboradores: {
        Row: {
          atualizado_em: string
          banco_agencia: string | null
          banco_conta: string | null
          banco_horas: number
          banco_nome: string | null
          banco_tipo_conta: string | null
          cargo_id: string
          celular: string | null
          chave_pix: string | null
          classificacao_performance:
            | Database["public"]["Enums"]["classificacao_performance_colaborador"]
            | null
          cnh: string | null
          cnpj: string | null
          codigo_externo: string | null
          cpf: string
          criado_em: string
          criado_por: string | null
          ctps_numero: string | null
          ctps_serie: string | null
          curso: string | null
          data_admissao: string
          data_contrato: string | null
          data_desligamento: string | null
          data_inicio_cargo: string | null
          data_nascimento: string | null
          departamento_id: string
          duplo_vinculo: boolean
          duracao_contrato: string | null
          email: string
          email_corporativo: string | null
          email_pessoal: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_complemento: string | null
          endereco_estado: string | null
          endereco_logradouro: string | null
          endereco_numero: string | null
          endereco_pais: string | null
          escolaridade:
            | Database["public"]["Enums"]["escolaridade_colaborador"]
            | null
          estado_civil:
            | Database["public"]["Enums"]["estado_civil_colaborador"]
            | null
          estrangeiro: boolean
          foto_url: string | null
          fuso_horario: string
          genero: Database["public"]["Enums"]["genero_colaborador"] | null
          grau_hierarquico: string | null
          id: string
          inicio_vigencia: string | null
          insalubridade: boolean
          matricula: string | null
          matricula_esocial: string | null
          moeda: string
          motivo_desligamento_id: string | null
          nacionalidade: string | null
          naturalidade: string | null
          nome_completo: string
          nome_mae: string | null
          nome_pai: string | null
          nome_social: string | null
          percentual_insalubridade: number | null
          perfil_analista: number | null
          perfil_comunicador: number | null
          perfil_executor: number | null
          perfil_planejador: number | null
          periculosidade: boolean
          periodo_experiencia_dias: number | null
          permite_bater_ponto: boolean
          pessoa_com_deficiencia: boolean
          pis: string | null
          quantidade_filhos: number | null
          raca_etnia:
            | Database["public"]["Enums"]["raca_etnia_colaborador"]
            | null
          razao_social: string | null
          reservista: string | null
          rg: string | null
          rg_data_expedicao: string | null
          rg_orgao_expedidor: string | null
          salario: number | null
          saudacao: string | null
          secao_eleitoral: string | null
          sexo: Database["public"]["Enums"]["sexo_colaborador"] | null
          status: Database["public"]["Enums"]["status_colaborador"]
          superior_direto_id: string | null
          tamanho_camisa: string | null
          telefone: string | null
          telefone_emergencia: string | null
          tipo_contrato: Database["public"]["Enums"]["tipo_contrato_colaborador"]
          tipo_deficiencia: string | null
          titulo_eleitor: string | null
          turno: string | null
          unidade_id: string
          vencimento_contrato: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          atualizado_em?: string
          banco_agencia?: string | null
          banco_conta?: string | null
          banco_horas?: number
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          cargo_id: string
          celular?: string | null
          chave_pix?: string | null
          classificacao_performance?:
            | Database["public"]["Enums"]["classificacao_performance_colaborador"]
            | null
          cnh?: string | null
          cnpj?: string | null
          codigo_externo?: string | null
          cpf: string
          criado_em?: string
          criado_por?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          curso?: string | null
          data_admissao: string
          data_contrato?: string | null
          data_desligamento?: string | null
          data_inicio_cargo?: string | null
          data_nascimento?: string | null
          departamento_id: string
          duplo_vinculo?: boolean
          duracao_contrato?: string | null
          email: string
          email_corporativo?: string | null
          email_pessoal?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_pais?: string | null
          escolaridade?:
            | Database["public"]["Enums"]["escolaridade_colaborador"]
            | null
          estado_civil?:
            | Database["public"]["Enums"]["estado_civil_colaborador"]
            | null
          estrangeiro?: boolean
          foto_url?: string | null
          fuso_horario?: string
          genero?: Database["public"]["Enums"]["genero_colaborador"] | null
          grau_hierarquico?: string | null
          id?: string
          inicio_vigencia?: string | null
          insalubridade?: boolean
          matricula?: string | null
          matricula_esocial?: string | null
          moeda?: string
          motivo_desligamento_id?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo: string
          nome_mae?: string | null
          nome_pai?: string | null
          nome_social?: string | null
          percentual_insalubridade?: number | null
          perfil_analista?: number | null
          perfil_comunicador?: number | null
          perfil_executor?: number | null
          perfil_planejador?: number | null
          periculosidade?: boolean
          periodo_experiencia_dias?: number | null
          permite_bater_ponto?: boolean
          pessoa_com_deficiencia?: boolean
          pis?: string | null
          quantidade_filhos?: number | null
          raca_etnia?:
            | Database["public"]["Enums"]["raca_etnia_colaborador"]
            | null
          razao_social?: string | null
          reservista?: string | null
          rg?: string | null
          rg_data_expedicao?: string | null
          rg_orgao_expedidor?: string | null
          salario?: number | null
          saudacao?: string | null
          secao_eleitoral?: string | null
          sexo?: Database["public"]["Enums"]["sexo_colaborador"] | null
          status?: Database["public"]["Enums"]["status_colaborador"]
          superior_direto_id?: string | null
          tamanho_camisa?: string | null
          telefone?: string | null
          telefone_emergencia?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato_colaborador"]
          tipo_deficiencia?: string | null
          titulo_eleitor?: string | null
          turno?: string | null
          unidade_id: string
          vencimento_contrato?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          atualizado_em?: string
          banco_agencia?: string | null
          banco_conta?: string | null
          banco_horas?: number
          banco_nome?: string | null
          banco_tipo_conta?: string | null
          cargo_id?: string
          celular?: string | null
          chave_pix?: string | null
          classificacao_performance?:
            | Database["public"]["Enums"]["classificacao_performance_colaborador"]
            | null
          cnh?: string | null
          cnpj?: string | null
          codigo_externo?: string | null
          cpf?: string
          criado_em?: string
          criado_por?: string | null
          ctps_numero?: string | null
          ctps_serie?: string | null
          curso?: string | null
          data_admissao?: string
          data_contrato?: string | null
          data_desligamento?: string | null
          data_inicio_cargo?: string | null
          data_nascimento?: string | null
          departamento_id?: string
          duplo_vinculo?: boolean
          duracao_contrato?: string | null
          email?: string
          email_corporativo?: string | null
          email_pessoal?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_complemento?: string | null
          endereco_estado?: string | null
          endereco_logradouro?: string | null
          endereco_numero?: string | null
          endereco_pais?: string | null
          escolaridade?:
            | Database["public"]["Enums"]["escolaridade_colaborador"]
            | null
          estado_civil?:
            | Database["public"]["Enums"]["estado_civil_colaborador"]
            | null
          estrangeiro?: boolean
          foto_url?: string | null
          fuso_horario?: string
          genero?: Database["public"]["Enums"]["genero_colaborador"] | null
          grau_hierarquico?: string | null
          id?: string
          inicio_vigencia?: string | null
          insalubridade?: boolean
          matricula?: string | null
          matricula_esocial?: string | null
          moeda?: string
          motivo_desligamento_id?: string | null
          nacionalidade?: string | null
          naturalidade?: string | null
          nome_completo?: string
          nome_mae?: string | null
          nome_pai?: string | null
          nome_social?: string | null
          percentual_insalubridade?: number | null
          perfil_analista?: number | null
          perfil_comunicador?: number | null
          perfil_executor?: number | null
          perfil_planejador?: number | null
          periculosidade?: boolean
          periodo_experiencia_dias?: number | null
          permite_bater_ponto?: boolean
          pessoa_com_deficiencia?: boolean
          pis?: string | null
          quantidade_filhos?: number | null
          raca_etnia?:
            | Database["public"]["Enums"]["raca_etnia_colaborador"]
            | null
          razao_social?: string | null
          reservista?: string | null
          rg?: string | null
          rg_data_expedicao?: string | null
          rg_orgao_expedidor?: string | null
          salario?: number | null
          saudacao?: string | null
          secao_eleitoral?: string | null
          sexo?: Database["public"]["Enums"]["sexo_colaborador"] | null
          status?: Database["public"]["Enums"]["status_colaborador"]
          superior_direto_id?: string | null
          tamanho_camisa?: string | null
          telefone?: string | null
          telefone_emergencia?: string | null
          tipo_contrato?: Database["public"]["Enums"]["tipo_contrato_colaborador"]
          tipo_deficiencia?: string | null
          titulo_eleitor?: string | null
          turno?: string | null
          unidade_id?: string
          vencimento_contrato?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "colaboradores_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_motivo_desligamento_id_fkey"
            columns: ["motivo_desligamento_id"]
            isOneToOne: false
            referencedRelation: "motivos_demissao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_superior_direto_id_fkey"
            columns: ["superior_direto_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "colaboradores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      competencia_cargos: {
        Row: {
          cargo_id: string
          competencia_id: string
        }
        Insert: {
          cargo_id: string
          competencia_id: string
        }
        Update: {
          cargo_id?: string
          competencia_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competencia_cargos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencia_cargos_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      competencias: {
        Row: {
          ativo: boolean
          criado_em: string
          descricao: string | null
          grupo_id: string
          id: string
          nome: string
          peso: number
          tipo_avaliacao: Database["public"]["Enums"]["tipo_avaliacao_competencia"]
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          grupo_id: string
          id?: string
          nome: string
          peso?: number
          tipo_avaliacao?: Database["public"]["Enums"]["tipo_avaliacao_competencia"]
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          descricao?: string | null
          grupo_id?: string
          id?: string
          nome?: string
          peso?: number
          tipo_avaliacao?: Database["public"]["Enums"]["tipo_avaliacao_competencia"]
        }
        Relationships: [
          {
            foreignKeyName: "competencias_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "grupos_competencias"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracao_avaliacao_experiencia: {
        Row: {
          atualizado_em: string
          cargo_ids: string[] | null
          habilitado: boolean
          id: boolean
          periodo_avaliativo: Database["public"]["Enums"]["periodo_avaliativo_experiencia"]
          tipos_contrato:
            | Database["public"]["Enums"]["tipo_contrato_colaborador"][]
            | null
        }
        Insert: {
          atualizado_em?: string
          cargo_ids?: string[] | null
          habilitado?: boolean
          id?: boolean
          periodo_avaliativo?: Database["public"]["Enums"]["periodo_avaliativo_experiencia"]
          tipos_contrato?:
            | Database["public"]["Enums"]["tipo_contrato_colaborador"][]
            | null
        }
        Update: {
          atualizado_em?: string
          cargo_ids?: string[] | null
          habilitado?: boolean
          id?: boolean
          periodo_avaliativo?: Database["public"]["Enums"]["periodo_avaliativo_experiencia"]
          tipos_contrato?:
            | Database["public"]["Enums"]["tipo_contrato_colaborador"][]
            | null
        }
        Relationships: []
      }
      departamento_gestores: {
        Row: {
          criado_em: string
          departamento_id: string
          gestor_id: string
        }
        Insert: {
          criado_em?: string
          departamento_id: string
          gestor_id: string
        }
        Update: {
          criado_em?: string
          departamento_id?: string
          gestor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamento_gestores_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departamento_gestores_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          email: string | null
          fax: string | null
          id: string
          localizacao: string | null
          nome: string
          orcamento_mensal: number
          ramal: string | null
          telefone: string | null
          unidade_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          localizacao?: string | null
          nome: string
          orcamento_mensal?: number
          ramal?: string | null
          telefone?: string | null
          unidade_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          localizacao?: string | null
          nome?: string
          orcamento_mensal?: number
          ramal?: string | null
          telefone?: string | null
          unidade_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      empresa_config: {
        Row: {
          atualizado_em: string
          id: boolean
          logo_url: string | null
          nome_empresa: string
        }
        Insert: {
          atualizado_em?: string
          id?: boolean
          logo_url?: string | null
          nome_empresa?: string
        }
        Update: {
          atualizado_em?: string
          id?: boolean
          logo_url?: string | null
          nome_empresa?: string
        }
        Relationships: []
      }
      feedbacks: {
        Row: {
          autor_id: string
          classificacao: Database["public"]["Enums"]["classificacao_feedback"]
          colaborador_id: string
          comentario: string
          criado_em: string
          data_feedback: string
          id: string
        }
        Insert: {
          autor_id: string
          classificacao: Database["public"]["Enums"]["classificacao_feedback"]
          colaborador_id: string
          comentario: string
          criado_em?: string
          data_feedback?: string
          id?: string
        }
        Update: {
          autor_id?: string
          classificacao?: Database["public"]["Enums"]["classificacao_feedback"]
          colaborador_id?: string
          comentario?: string
          criado_em?: string
          data_feedback?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedbacks_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
        ]
      }
      grupos_competencias: {
        Row: {
          ativo: boolean
          categoria_9box: Database["public"]["Enums"]["categoria_9box"]
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          categoria_9box?: Database["public"]["Enums"]["categoria_9box"]
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          categoria_9box?: Database["public"]["Enums"]["categoria_9box"]
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      metas: {
        Row: {
          codigo: string | null
          criado_em: string
          descricao: string
          id: string
          mes_ano: string
          nome: string
          valor_meta: number
        }
        Insert: {
          codigo?: string | null
          criado_em?: string
          descricao: string
          id?: string
          mes_ano: string
          nome: string
          valor_meta?: number
        }
        Update: {
          codigo?: string | null
          criado_em?: string
          descricao?: string
          id?: string
          mes_ano?: string
          nome?: string
          valor_meta?: number
        }
        Relationships: []
      }
      motivos_demissao: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      perfis: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          nome_completo: string
          papel: Database["public"]["Enums"]["papel_usuario"]
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email: string
          id: string
          nome_completo: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          nome_completo?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Relationships: []
      }
      registros: {
        Row: {
          autor_id: string
          classificacao: Database["public"]["Enums"]["classificacao_registro"]
          colaborador_id: string
          criado_em: string
          data_registro: string
          descricao: string
          id: string
          tipo_registro_id: string
          valor_qtd_horas: number
        }
        Insert: {
          autor_id: string
          classificacao: Database["public"]["Enums"]["classificacao_registro"]
          colaborador_id: string
          criado_em?: string
          data_registro?: string
          descricao: string
          id?: string
          tipo_registro_id: string
          valor_qtd_horas?: number
        }
        Update: {
          autor_id?: string
          classificacao?: Database["public"]["Enums"]["classificacao_registro"]
          colaborador_id?: string
          criado_em?: string
          data_registro?: string
          descricao?: string
          id?: string
          tipo_registro_id?: string
          valor_qtd_horas?: number
        }
        Relationships: [
          {
            foreignKeyName: "registros_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "colaboradores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_tipo_registro_id_fkey"
            columns: ["tipo_registro_id"]
            isOneToOne: false
            referencedRelation: "tipos_registro"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_registro: {
        Row: {
          ativo: boolean
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      unidades: {
        Row: {
          atualizado_em: string
          criado_em: string
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      managed_department_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      aplicado_como_beneficio: "reais" | "percentual_salario"
      categoria_9box: "nenhuma" | "comportamento" | "desempenho"
      classificacao_feedback: "positivo" | "para_melhorar" | "neutro"
      classificacao_performance_colaborador: "baixa" | "alta"
      classificacao_registro: "positivo" | "negativo" | "neutro"
      escolaridade_colaborador:
        | "fundamental_incompleto"
        | "fundamental_completo"
        | "medio_incompleto"
        | "medio_completo"
        | "superior_incompleto"
        | "superior_completo"
        | "pos_graduacao"
        | "mestrado"
        | "doutorado"
      estado_civil_colaborador:
        | "solteiro"
        | "casado"
        | "divorciado"
        | "viuvo"
        | "uniao_estavel"
      genero_colaborador:
        | "feminino"
        | "masculino"
        | "outro"
        | "prefiro_nao_informar"
      nivel_estrutura_avaliacao: "unidade" | "departamento" | "cargo"
      opcao_desconto_beneficio: "percentual_salario" | "valor_fixo"
      papel_usuario: "admin_rh" | "gestor"
      periodicidade_beneficio:
        | "diario"
        | "semanal"
        | "quinzenal"
        | "mensal"
        | "anual"
      periodo_avaliativo_experiencia:
        | "90_dias"
        | "45_e_90_dias"
        | "30_60_e_90_dias"
      raca_etnia_colaborador:
        | "branca"
        | "preta"
        | "parda"
        | "amarela"
        | "indigena"
        | "nao_informado"
      resultado_exame_ocupacional: "apto" | "apto_com_restricoes" | "inapto"
      senioridade_cargo:
        | "estagiario"
        | "junior"
        | "pleno"
        | "senior"
        | "especialista"
        | "lideranca"
      sexo_colaborador: "masculino" | "feminino"
      status_avaliacao_experiencia: "pendente" | "respondida" | "expirada"
      status_ciclo_avaliativo: "rascunho" | "ativo" | "encerrado"
      status_colaborador: "ativo" | "inativo"
      tipo_avaliacao_competencia: "desempenho" | "periodo_experiencia"
      tipo_beneficio:
        | "vale_refeicao"
        | "vale_alimentacao"
        | "vale_transporte"
        | "plano_saude"
        | "plano_odontologico"
        | "seguro_vida"
        | "auxilio_creche"
        | "auxilio_educacao"
        | "gympass"
        | "plr"
        | "outro"
      tipo_checklist: "admissao" | "demissao"
      tipo_contrato_colaborador:
        | "clt"
        | "pj"
        | "estagio"
        | "temporario"
        | "aprendiz"
      tipo_exame_ocupacional:
        | "admissional"
        | "periodico"
        | "retorno_trabalho"
        | "mudanca_funcao"
        | "demissional"
      tipo_relacao_avaliacao:
        | "direta_90"
        | "conjunta_180"
        | "trezentos_sessenta"
        | "customizada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

// ---------------------------------------------------------------------------
// Aliases de conveniência usados em todo o app (lib/, components/, actions).
// Ao rodar `npx supabase gen types typescript --linked --schema public` de
// novo, cole o resultado por cima do conteúdo ACIMA desta seção e mantenha
// este bloco.
// ---------------------------------------------------------------------------

export type PapelUsuario = Database["public"]["Enums"]["papel_usuario"];
export type GeneroColaborador =
  Database["public"]["Enums"]["genero_colaborador"];
export type SexoColaborador = Database["public"]["Enums"]["sexo_colaborador"];
export type RacaEtniaColaborador =
  Database["public"]["Enums"]["raca_etnia_colaborador"];
export type EstadoCivilColaborador =
  Database["public"]["Enums"]["estado_civil_colaborador"];
export type EscolaridadeColaborador =
  Database["public"]["Enums"]["escolaridade_colaborador"];
export type StatusColaborador =
  Database["public"]["Enums"]["status_colaborador"];
export type ClassificacaoRegistro =
  Database["public"]["Enums"]["classificacao_registro"];
export type TipoChecklist = Database["public"]["Enums"]["tipo_checklist"];
export type SenioridadeCargo =
  Database["public"]["Enums"]["senioridade_cargo"];
export type TipoContratoColaborador =
  Database["public"]["Enums"]["tipo_contrato_colaborador"];
export type TipoExameOcupacional =
  Database["public"]["Enums"]["tipo_exame_ocupacional"];
export type ResultadoExameOcupacional =
  Database["public"]["Enums"]["resultado_exame_ocupacional"];

export type PerfilRow = Database["public"]["Tables"]["perfis"]["Row"];
export type UnidadeRow = Database["public"]["Tables"]["unidades"]["Row"];
export type CargoRow = Database["public"]["Tables"]["cargos"]["Row"];
export type CargoTracoComportamentalRow =
  Database["public"]["Tables"]["cargo_tracos_comportamentais"]["Row"];
export type MotivoDemissaoRow =
  Database["public"]["Tables"]["motivos_demissao"]["Row"];
export type TipoRegistroRow =
  Database["public"]["Tables"]["tipos_registro"]["Row"];
export type ChecklistTopicoRow =
  Database["public"]["Tables"]["checklist_topicos"]["Row"];
export type EmpresaConfigRow =
  Database["public"]["Tables"]["empresa_config"]["Row"];
export type DepartamentoRow =
  Database["public"]["Tables"]["departamentos"]["Row"];
export type DepartamentoGestorRow =
  Database["public"]["Tables"]["departamento_gestores"]["Row"];
export type ColaboradorRow =
  Database["public"]["Tables"]["colaboradores"]["Row"];
export type RegistroRow = Database["public"]["Tables"]["registros"]["Row"];
export type ColaboradorDependenteRow =
  Database["public"]["Tables"]["colaborador_dependentes"]["Row"];
export type ColaboradorDocumentoRow =
  Database["public"]["Tables"]["colaborador_documentos"]["Row"];
export type ColaboradorExameRow =
  Database["public"]["Tables"]["colaborador_exames"]["Row"];
export type ColaboradorTracoComportamentalRow =
  Database["public"]["Tables"]["colaborador_tracos_comportamentais"]["Row"];
export type ColaboradorHistoricoCargoRow =
  Database["public"]["Tables"]["colaborador_historico_cargo"]["Row"];
export type ColaboradorLinkPreenchimentoRow =
  Database["public"]["Tables"]["colaborador_links_preenchimento"]["Row"];
export type FeedbackRow = Database["public"]["Tables"]["feedbacks"]["Row"];
export type ClassificacaoFeedback =
  Database["public"]["Enums"]["classificacao_feedback"];
export type GrupoCompetenciaRow =
  Database["public"]["Tables"]["grupos_competencias"]["Row"];
export type Categoria9box = Database["public"]["Enums"]["categoria_9box"];
export type CompetenciaRow = Database["public"]["Tables"]["competencias"]["Row"];
export type CompetenciaCargoRow =
  Database["public"]["Tables"]["competencia_cargos"]["Row"];
export type TipoAvaliacaoCompetencia =
  Database["public"]["Enums"]["tipo_avaliacao_competencia"];
export type CicloAvaliativoRow =
  Database["public"]["Tables"]["ciclos_avaliativos"]["Row"];
export type StatusCicloAvaliativo =
  Database["public"]["Enums"]["status_ciclo_avaliativo"];
export type TipoRelacaoAvaliacao =
  Database["public"]["Enums"]["tipo_relacao_avaliacao"];
export type NivelEstruturaAvaliacao =
  Database["public"]["Enums"]["nivel_estrutura_avaliacao"];
export type CicloAvaliativoParticipanteRow =
  Database["public"]["Tables"]["ciclo_avaliativo_participantes"]["Row"];
export type ConfiguracaoAvaliacaoExperienciaRow =
  Database["public"]["Tables"]["configuracao_avaliacao_experiencia"]["Row"];
export type PeriodoAvaliativoExperiencia =
  Database["public"]["Enums"]["periodo_avaliativo_experiencia"];
export type AvaliacaoExperienciaRow =
  Database["public"]["Tables"]["avaliacoes_experiencia"]["Row"];
export type StatusAvaliacaoExperiencia =
  Database["public"]["Enums"]["status_avaliacao_experiencia"];
export type MetaRow = Database["public"]["Tables"]["metas"]["Row"];
export type ClassificacaoPerformanceColaborador =
  Database["public"]["Enums"]["classificacao_performance_colaborador"];
export type BeneficioRow = Database["public"]["Tables"]["beneficios"]["Row"];
export type TipoBeneficio = Database["public"]["Enums"]["tipo_beneficio"];
export type AplicadoComoBeneficio = Database["public"]["Enums"]["aplicado_como_beneficio"];
export type PeriodicidadeBeneficio = Database["public"]["Enums"]["periodicidade_beneficio"];
export type OpcaoDescontoBeneficio = Database["public"]["Enums"]["opcao_desconto_beneficio"];
export type BeneficiarioRow = Database["public"]["Tables"]["beneficiarios"]["Row"];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      aplicado_como_beneficio: ["reais", "percentual_salario"],
      categoria_9box: ["nenhuma", "comportamento", "desempenho"],
      classificacao_feedback: ["positivo", "para_melhorar", "neutro"],
      classificacao_performance_colaborador: ["baixa", "alta"],
      classificacao_registro: ["positivo", "negativo", "neutro"],
      escolaridade_colaborador: [
        "fundamental_incompleto",
        "fundamental_completo",
        "medio_incompleto",
        "medio_completo",
        "superior_incompleto",
        "superior_completo",
        "pos_graduacao",
        "mestrado",
        "doutorado",
      ],
      estado_civil_colaborador: [
        "solteiro",
        "casado",
        "divorciado",
        "viuvo",
        "uniao_estavel",
      ],
      genero_colaborador: [
        "feminino",
        "masculino",
        "outro",
        "prefiro_nao_informar",
      ],
      nivel_estrutura_avaliacao: ["unidade", "departamento", "cargo"],
      opcao_desconto_beneficio: ["percentual_salario", "valor_fixo"],
      papel_usuario: ["admin_rh", "gestor"],
      periodicidade_beneficio: [
        "diario",
        "semanal",
        "quinzenal",
        "mensal",
        "anual",
      ],
      periodo_avaliativo_experiencia: [
        "90_dias",
        "45_e_90_dias",
        "30_60_e_90_dias",
      ],
      raca_etnia_colaborador: [
        "branca",
        "preta",
        "parda",
        "amarela",
        "indigena",
        "nao_informado",
      ],
      resultado_exame_ocupacional: ["apto", "apto_com_restricoes", "inapto"],
      senioridade_cargo: [
        "estagiario",
        "junior",
        "pleno",
        "senior",
        "especialista",
        "lideranca",
      ],
      sexo_colaborador: ["masculino", "feminino"],
      status_avaliacao_experiencia: ["pendente", "respondida", "expirada"],
      status_ciclo_avaliativo: ["rascunho", "ativo", "encerrado"],
      status_colaborador: ["ativo", "inativo"],
      tipo_avaliacao_competencia: ["desempenho", "periodo_experiencia"],
      tipo_beneficio: [
        "vale_refeicao",
        "vale_alimentacao",
        "vale_transporte",
        "plano_saude",
        "plano_odontologico",
        "seguro_vida",
        "auxilio_creche",
        "auxilio_educacao",
        "gympass",
        "plr",
        "outro",
      ],
      tipo_checklist: ["admissao", "demissao"],
      tipo_contrato_colaborador: [
        "clt",
        "pj",
        "estagio",
        "temporario",
        "aprendiz",
      ],
      tipo_exame_ocupacional: [
        "admissional",
        "periodico",
        "retorno_trabalho",
        "mudanca_funcao",
        "demissional",
      ],
      tipo_relacao_avaliacao: [
        "direta_90",
        "conjunta_180",
        "trezentos_sessenta",
        "customizada",
      ],
    },
  },
} as const
