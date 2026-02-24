package tr.org.lider.services;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import tr.org.lider.entities.PolicyExceptionImpl;
import tr.org.lider.entities.PolicyImpl;
import tr.org.lider.repositories.PolicyExceptionRepository;

/**
 * Policy Exception service
 * 
 * @author <a href="mailto:tuncay.colak@tubitak.gov.tr">Tuncay ÇOLAK</a>
 * 
 */

@Service
public class PolicyExceptionService {
	Logger logger = LoggerFactory.getLogger(PolicyExceptionService.class);

	@Autowired
	private PolicyExceptionRepository policyExceptionRepository;

	public List<PolicyExceptionImpl> list( ){
		return policyExceptionRepository.findAll();
	}
	
	public List<PolicyExceptionImpl> listByDn(String dn){
		return policyExceptionRepository.findByDn(dn);
	}
	
	public List<PolicyExceptionImpl> listByPolicy(Long id){
		return policyExceptionRepository.findByPolicy(id);
	}
	
	public List<PolicyExceptionImpl> findByPolicyAndDn(PolicyImpl policy, String dn){
		return policyExceptionRepository.findByPolicyAndDn(policy, dn);
	}
	
	public List<PolicyExceptionImpl> findByPolicyAndGroupDn(PolicyImpl policy, String dn){
		return policyExceptionRepository.findByPolicyAndGroupDn(policy, dn);
	}
	
	public PolicyExceptionImpl add(PolicyExceptionImpl policyExceptionImpl) {
		PolicyExceptionImpl existPolicyException = policyExceptionRepository.save(policyExceptionImpl);
		return existPolicyException;
	}

	public void delete(Long id) {
		policyExceptionRepository.deleteById(id);
//		return true;
	}

	public PolicyExceptionImpl update(PolicyExceptionImpl policyExceptionImpl) {
		PolicyExceptionImpl existPolicyException = policyExceptionRepository.findOne(policyExceptionImpl.getId());
		existPolicyException.setLabel(policyExceptionImpl.getLabel());
		existPolicyException.setDescription(policyExceptionImpl.getDescription());
		existPolicyException.setModifyDate(new Date());
		return policyExceptionRepository.save(existPolicyException);
	}

	public Optional<PolicyExceptionImpl> findPolicyExceptionByID(Long id) {
		return policyExceptionRepository.findById(id);
	}
	
	public void deletePolicyExceptionByPolicy(PolicyImpl policy) {
		policyExceptionRepository.deleteByPolicy(policy);
	}


//	public List<PolicyResponse> getPoliciesExceptionForGroup(String dn) {
//		List<Object[]> results = policyRepository.findPoliciesByGroupDn(dn);
//		List<PolicyResponse> resp= new ArrayList<PolicyResponse>();
//		for (Object[] objects : results) {
//			PolicyResponse policyResponse= new PolicyResponse();
//			policyResponse.setPolicyImpl((PolicyImpl)objects[0]);
//			policyResponse.setCommandExecutionImpl((CommandExecutionImpl)objects[1]);
//			policyResponse.setCommandImpl((CommandImpl)objects[2]);
//			resp.add(policyResponse);
//		}
//		return resp;
//	}
}