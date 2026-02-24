package tr.org.lider.controllers;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Lider info controller for getting information about lider project
 * 
 * @author <a href="mailto:hasan.kara@pardus.org.tr">Hasan Kara</a>
 * 
 */
@RestController
@RequestMapping("/api/lider-info")
@Tag(name = "Lider Info", description = "Lider Info Rest Service")
public class LiderInfoController {

	@Autowired
	private BuildProperties buildProperties;
	
	@Operation(summary = "Get lider version", description = "", tags = { "lider version info" })
	@ApiResponses(value = { 
			@ApiResponse(responseCode = "200", description = "Returns lider version", 
				content = { @Content(schema = @Schema(implementation = String.class)) })})
	@GetMapping(value = "/version", produces = MediaType.APPLICATION_JSON_VALUE)
	public ResponseEntity<String> getLiderVersion() {
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(buildProperties.getVersion());
	}
}
