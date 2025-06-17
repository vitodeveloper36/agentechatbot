using System.Data;
using Microsoft.Data.SqlClient;
using Dapper;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = WebApplication.CreateBuilder(args);

// 1) Configuración de cadenas de conexión
var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddTransient<IDbConnection>(_ =>
    new SqlConnection(defaultConn));

// 2) Registrar HttpClient apuntando a tu API de archivos
//    Nota: guardamos builder.Configuration en una variable local para capturarla correctamente
var config = builder.Configuration;
builder.Services
    .AddHttpClient("ChatBotApi", client =>
    {
        var baseUrl = config["ChatBotApi:BaseUrl"];
        if (string.IsNullOrEmpty(baseUrl))
        {
            throw new InvalidOperationException("Falta configurar ChatBotApi:BaseUrl en appsettings.json");
        }
        client.BaseAddress = new Uri(baseUrl);
    });

// 3) Registrar MVC/controllers
builder.Services.AddControllersWithViews();

var app = builder.Build();

// 4) Middleware estándar
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseAuthorization();

// 5) Rutas
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Chat}/{action=Index}/{id?}");

app.Run();
