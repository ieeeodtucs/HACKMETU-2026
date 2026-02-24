package tr.org.lider.controllers;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.services.DashboardService;

@RestController
@RequestMapping(value = "/api/dashboard")
@Tag(name="Dashboard",description = "Dashboard Rest Service")
public class DashboardController {
	
	@Autowired
	private DashboardService dashboardService;

	@Operation(summary = "Gets the dashboard", description = "", tags = { "dasboard-service" })
	@ApiResponses(value = { 
			  @ApiResponse(responseCode = "200", description = "Returns the dashboard"),
			  @ApiResponse(responseCode = "417", description = "Could not get  the dashboard.Unexpected error occured.", 
			    content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/info")
	public ResponseEntity<Map<String, Object>>  getDashboardInfo() {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(dashboardService.getDashboardReport());
				
	}

}
