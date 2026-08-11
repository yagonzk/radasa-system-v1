# Romaneio PDF v10

Correção específica para PDFs SIGA híbridos cuja camada de texto traz o cabeçalho como `SIGA /[FATRU41/v.12`.

A versão anterior procurava literalmente `SIGA/FATRU41`, então esse PDF não era classificado como SIGA e o OCR híbrido não era acionado. Agora a detecção ignora pontuação/espaços e combina a camada digital com OCR de alta resolução.

Parser: `2026.08.11.03`.
