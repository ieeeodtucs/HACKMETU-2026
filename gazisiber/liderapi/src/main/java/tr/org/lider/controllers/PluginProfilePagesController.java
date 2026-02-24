package tr.org.lider.controllers;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.ModelAndView;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import tr.org.lider.entities.OperationLogImpl;
import tr.org.lider.entities.PluginProfile;
import tr.org.lider.services.PluginService;

/**
 * Plugin profile pages rendered
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 * 
 */

@RestController
@Tag(name = "Plugin Profil Pages",description = "Plugin Pfofil Rest Service")
public class PluginProfilePagesController {
	
	Logger logger = LoggerFactory.getLogger(PluginProfilePagesController.class);
	
	@Autowired
	public PluginService pluginService;
	
	
	//@RequestMapping(value="/getPluginProfileList", method = {RequestMethod.POST })
	@Operation(summary = "Gets plugin profile list", description = "", tags = { "plugin-profile-pages" })
	@ApiResponses(value = { 
      	  @ApiResponse(responseCode = "200", description = "",
			  content = { @Content(schema = @Schema(implementation = OperationLogImpl.class))}),
		  @ApiResponse(responseCode = "417",description = "An error was received while fetching the plugin profile list.Unexpected error occurred",
	   		 content = @Content(schema = @Schema(implementation = String.class))) })
	@PostMapping(value = "/api/get-plugin-profile-list")
	public ResponseEntity<List<PluginProfile>> getPluginTaskList(Model model, PluginProfile pluginProfile) {
		logger.info("Getting plugink list ");
		List<PluginProfile>  list = pluginService.findAllPluginProfile();
		return ResponseEntity
				.status(HttpStatus.OK)
				.body(list);
			
	}
}
