using Agentechatbot.Models;
using Dapper;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace Agentechatbot.Controllers
{
    public class ChatController : Controller
    {
        private readonly string _connectionString;
        private readonly IHttpClientFactory _httpClientFactory;

        public ChatController(IConfiguration configuration, IHttpClientFactory httpClientFactory)
        {
            _connectionString = configuration.GetConnectionString("DefaultConnection");
            _httpClientFactory = httpClientFactory;
        }

        [HttpPost]
        [ValidateAntiForgeryToken]
        public IActionResult DownloadFile(string sessionId, string fileName)
        {
            try
            {
                if (string.IsNullOrEmpty(sessionId) || string.IsNullOrEmpty(fileName))
                    return BadRequest("Información de archivo incompleta");

                // Construir la ruta de la carpeta de archivos para esta sesión
                string basePath = @"C:\Users\VICTOR\source\repos\ChatbotAPI\ChatBotAPI\uploads";

                // Ruta completa incluyendo sessionId
                string sessionFolderPath = Path.Combine(basePath, sessionId);

                // Ruta completa al archivo
                string filePath = Path.Combine(sessionFolderPath, fileName);

                // Verificar si el archivo existe
                if (!System.IO.File.Exists(filePath))
                    return NotFound($"El archivo «{fileName}» no existe");

                // Determinar el tipo de contenido según la extensión
                string contentType = GetContentType(Path.GetExtension(fileName));

                // Leer el archivo y devolverlo como FileResult
                byte[] fileBytes = System.IO.File.ReadAllBytes(filePath);

                return File(fileBytes, contentType, fileName);
            }
            catch (Exception ex)
            {
                // Registrar el error
                return StatusCode(500, $"Error al descargar el archivo: {ex.Message}");
            }
        }

        // Método auxiliar para determinar el tipo de contenido según la extensión
        private string GetContentType(string extension)
        {
            switch (extension.ToLower())
            {
                case ".pdf": return "application/pdf";
                case ".doc": return "application/msword";
                case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                case ".xls": return "application/vnd.ms-excel";
                case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".png": return "image/png";
                case ".gif": return "image/gif";
                case ".txt": return "text/plain";
                default: return "application/octet-stream"; // Tipo genérico para archivos binarios
            }
        }

        [HttpGet]
        public IActionResult GetSessionFiles(string sessionId)
        {
            try
            {
                // Validar el sessionId
                if (string.IsNullOrEmpty(sessionId))
                {
                    return BadRequest("ID de sesión requerido");
                }

                // Construir la ruta de la carpeta de archivos para esta sesión
                string basePath = @"C:\Users\VICTOR\source\repos\ChatbotAPI\ChatBotAPI\uploads";

                // Ruta completa incluyendo sessionId
                string sessionFolderPath = Path.Combine(basePath, sessionId);

                // Verificar si la carpeta existe
                if (!Directory.Exists(sessionFolderPath))
                {
                    // Si no existe, crearla
                    Directory.CreateDirectory(sessionFolderPath);
                    return Json(new List<object>()); // Devolver lista vacía
                }

                // Obtener todos los archivos en la carpeta
                var files = Directory.GetFiles(sessionFolderPath)
                    .Select(file => new FileInfo(file))
                    .Select(fileInfo => new
                    {
                        fileName = fileInfo.Name,
                        name = Path.GetFileName(fileInfo.Name.Contains('_') ?
                               fileInfo.Name.Substring(fileInfo.Name.IndexOf('_') + 1) :
                               fileInfo.Name),
                        extension = fileInfo.Extension,
                        size = FormatFileSize(fileInfo.Length),
                        dateUploaded = fileInfo.CreationTime.ToString("dd/MM/yyyy HH:mm")
                    })
                    .OrderByDescending(f => f.dateUploaded)
                    .ToList();

                return Json(files);
            }
            catch (Exception ex)
            {
                // Registrar el error
                return StatusCode(500, "Error al procesar la solicitud");
            }
        }

        // Método auxiliar para formatear el tamaño del archivo
        private string FormatFileSize(long bytes)
        {
            string[] suffixes = { "B", "KB", "MB", "GB", "TB" };
            int counter = 0;
            decimal number = bytes;

            while (Math.Round(number / 1024) >= 1)
            {
                number /= 1024;
                counter++;
            }

            return $"{number:n1} {suffixes[counter]}";
        }
        
        public async Task<IActionResult> Welcome()
        {
            using var connection = new SqlConnection(_connectionString);

            // Consulta todas las sesiones ordenadas por StartedAt
            const string sql = @"SELECT SessionId, Usuario, StartedAt, LastActivity, IsClosed
                        FROM ChatBot.dbo.ChatSession
                        ORDER BY StartedAt DESC";

            IEnumerable<ChatSession> sessions = await connection.QueryAsync<ChatSession>(sql);
            return View(sessions);
        }

        public IActionResult Index(string agentName, string sessionId)
        {
            if (string.IsNullOrEmpty(agentName))
            {
                return RedirectToAction("Welcome");
            }

            TempData["agentName"] = agentName;
            TempData["sessionId"] = string.IsNullOrEmpty(sessionId) ? Guid.NewGuid().ToString() : sessionId;

            return View();
        }

        [HttpGet]
        public async Task<IActionResult> GetSessions()
        {
            using var connection = new SqlConnection(_connectionString);

            // Consulta todas las sesiones ordenadas por SessionId
            const string sql = @"SELECT SessionId, Usuario, StartedAt, LastActivity, IsClosed
                                 FROM ChatBot.dbo.ChatSession
                                 ORDER BY SessionId";

            IEnumerable<ChatSession> sessions = await connection.QueryAsync<ChatSession>(sql);
            return Ok(sessions);
        }


    }
}