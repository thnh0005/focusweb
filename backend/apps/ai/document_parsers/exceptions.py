class DocumentExtractionError(Exception):
    error_code = "EXTRACTION_FAILED"
    safe_message = "Document extraction failed."
    retryable = False

    def __init__(self, message=None, error_code=None, retryable=None):
        super().__init__(message or self.safe_message)
        if error_code:
            self.error_code = error_code
        if retryable is not None:
            self.retryable = retryable
        self.safe_message = message or self.safe_message


class FileNotFoundError(DocumentExtractionError):
    error_code = "FILE_NOT_FOUND"
    safe_message = "Document file was not found."


class FileTooLargeError(DocumentExtractionError):
    error_code = "FILE_TOO_LARGE"
    safe_message = "Document file is too large."


class UnsupportedFileTypeError(DocumentExtractionError):
    error_code = "UNSUPPORTED_FILE_TYPE"
    safe_message = "Document file type is not supported."


class FileTypeMismatchError(DocumentExtractionError):
    error_code = "FILE_TYPE_MISMATCH"
    safe_message = "File extension does not match file content."


class InvalidPDFError(DocumentExtractionError):
    error_code = "INVALID_PDF"
    safe_message = "PDF file could not be parsed."


class EncryptedPDFError(DocumentExtractionError):
    error_code = "ENCRYPTED_PDF"
    safe_message = "Password-protected PDF files are not supported."


class InvalidDOCXError(DocumentExtractionError):
    error_code = "INVALID_DOCX"
    safe_message = "DOCX file could not be parsed."


class TextEncodingError(DocumentExtractionError):
    error_code = "TEXT_ENCODING_ERROR"
    safe_message = "Text file encoding is not supported."


class BinaryTextFileError(DocumentExtractionError):
    error_code = "BINARY_TEXT_FILE"
    safe_message = "Binary files cannot be parsed as text."

